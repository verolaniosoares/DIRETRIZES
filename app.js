'use strict';

// ---------- Constantes ----------
const STORAGE_KEY = 'controle-equipe-v1';

const STATUS = [
  { id: 'pendente', nome: 'Pendente' },
  { id: 'andamento', nome: 'Em andamento' },
  { id: 'revisao', nome: 'Em revisão' },
  { id: 'bloqueada', nome: 'Bloqueada' },
  { id: 'concluida', nome: 'Concluída' },
];
const PRIORIDADES = [
  { id: 'alta', nome: 'Alta' },
  { id: 'media', nome: 'Média' },
  { id: 'baixa', nome: 'Baixa' },
];
const DEPARTAMENTOS = ['Contábil', 'Fiscal', 'Pessoal', 'Societário', 'Financeiro', 'Administrativo'];
const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Isenta / Imune'];

// ---------- Estado ----------
let db = carregar();

function carregar() {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (bruto) return normalizar(JSON.parse(bruto));
  } catch (e) {
    console.error('Falha ao ler dados salvos', e);
  }
  return { empresas: [], membros: [], tarefas: [] };
}

function normalizar(d) {
  return {
    empresas: Array.isArray(d.empresas) ? d.empresas : [],
    membros: Array.isArray(d.membros) ? d.membros : [],
    tarefas: Array.isArray(d.tarefas) ? d.tarefas : [],
  };
}

function salvar() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    alert('Não foi possível salvar os dados neste navegador: ' + e.message);
  }
  renderizar();
}

// ---------- Utilitários ----------
const $ = (sel) => document.querySelector(sel);
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hoje = () => new Date().toISOString().slice(0, 10);

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtData(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function fmtCompetencia(c) {
  if (!c) return '';
  const [a, m] = c.split('-');
  return `${m}/${a}`;
}

function proximaCompetencia(c) {
  const [a, m] = c.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

// Avança uma data em um mês, ajustando o dia ao último dia do mês quando necessário.
function somarUmMes(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const na = m === 12 ? a + 1 : a;
  const nm = m === 12 ? 1 : m + 1;
  const ultimoDia = new Date(na, nm, 0).getDate();
  return `${na}-${String(nm).padStart(2, '0')}-${String(Math.min(d, ultimoDia)).padStart(2, '0')}`;
}

function diasAte(iso) {
  const alvo = new Date(iso + 'T00:00:00');
  const base = new Date(hoje() + 'T00:00:00');
  return Math.round((alvo - base) / 86400000);
}

const estaAtrasada = (t) => t.status !== 'concluida' && t.prazo && t.prazo < hoje();

const nomeEmpresa = (id) => db.empresas.find((e) => e.id === id)?.nome ?? '—';
const nomeMembro = (id) => db.membros.find((m) => m.id === id)?.nome ?? 'Sem responsável';
const nomeStatus = (id) => STATUS.find((s) => s.id === id)?.nome ?? id;
const nomePrioridade = (id) => PRIORIDADES.find((p) => p.id === id)?.nome ?? id;

const badgeStatus = (s) => `<span class="badge st-${esc(s)}">${esc(nomeStatus(s))}</span>`;
const barra = (pct) => `<div class="progress" title="${pct}%"><span style="width:${pct}%"></span></div>`;

function tabela(colunas, linhas, vazio = 'Nenhum registro.') {
  if (!linhas.length) return `<div class="vazio">${vazio}</div>`;
  return `<table><thead><tr>${colunas.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.join('')}</tbody></table>`;
}

function preencherSelect(sel, opcoes, rotuloTodos) {
  const atual = sel.value;
  sel.innerHTML = `<option value="">${rotuloTodos}</option>` +
    opcoes.map((o) => `<option value="${esc(o.id)}">${esc(o.nome)}</option>`).join('');
  sel.value = opcoes.some((o) => o.id === atual) ? atual : '';
}

// ---------- Navegação ----------
document.querySelectorAll('#tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + btn.dataset.view));
  });
});

// ---------- Modal genérico ----------
const modal = $('#modal');
let aoSalvar = null;
let aoExcluir = null;

function abrirModal(titulo, campos, valores, salvarFn, excluirFn) {
  $('#modal-titulo').textContent = titulo;
  $('#modal-campos').innerHTML = campos.map((c) => campoHtml(c, valores[c.nome])).join('');
  aoSalvar = salvarFn;
  aoExcluir = excluirFn;
  $('#modal-excluir').style.display = excluirFn ? '' : 'none';
  modal.showModal();
}

function campoHtml(c, valor) {
  const cls = c.full ? 'full' : c.tipo === 'checkbox' ? 'check' : '';
  const req = c.obrigatorio ? 'required' : '';
  const v = valor ?? c.padrao ?? '';
  let input;
  if (c.tipo === 'select') {
    const opts = (c.vazio !== undefined ? [{ id: '', nome: c.vazio }] : []).concat(c.opcoes);
    input = `<select name="${c.nome}" ${req}>${opts.map((o) => `<option value="${esc(o.id)}" ${o.id === v ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select>`;
  } else if (c.tipo === 'textarea') {
    input = `<textarea name="${c.nome}" rows="3">${esc(v)}</textarea>`;
  } else if (c.tipo === 'checkbox') {
    return `<label class="${cls}"><input type="checkbox" name="${c.nome}" ${v ? 'checked' : ''}> ${esc(c.rotulo)}</label>`;
  } else {
    const extra = c.tipo === 'number' ? 'min="0" max="100" step="5"' : '';
    input = `<input type="${c.tipo || 'text'}" name="${c.nome}" value="${esc(v)}" ${req} ${extra}>`;
  }
  return `<label class="${cls}">${esc(c.rotulo)}${input}</label>`;
}

$('#modal-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const dados = {};
  for (const el of $('#modal-form').elements) {
    if (!el.name) continue;
    dados[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value.trim();
  }
  aoSalvar(dados);
  modal.close();
  salvar();
});
$('#modal-cancelar').addEventListener('click', () => modal.close());
$('#modal-excluir').addEventListener('click', () => {
  if (aoExcluir && confirm('Confirma a exclusão?')) {
    aoExcluir();
    modal.close();
    salvar();
  }
});

// ---------- Empresas ----------
const camposEmpresa = () => [
  { nome: 'nome', rotulo: 'Razão social / nome', obrigatorio: true, full: true },
  { nome: 'cnpj', rotulo: 'CNPJ' },
  { nome: 'regime', rotulo: 'Regime tributário', tipo: 'select', vazio: '—', opcoes: REGIMES.map((r) => ({ id: r, nome: r })) },
  { nome: 'contato', rotulo: 'Contato' },
  { nome: 'responsavelId', rotulo: 'Responsável pela carteira', tipo: 'select', vazio: '—', opcoes: membrosAtivos() },
  { nome: 'ativa', rotulo: 'Empresa ativa', tipo: 'checkbox', padrao: true },
  { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', full: true },
];

function editarEmpresa(id) {
  const e = db.empresas.find((x) => x.id === id);
  abrirModal(e ? 'Editar empresa' : 'Nova empresa', camposEmpresa(), e || {},
    (d) => (e ? Object.assign(e, d) : db.empresas.push({ id: novoId(), ...d })),
    e && (() => {
      const qtd = db.tarefas.filter((t) => t.empresaId === id).length;
      if (qtd && !confirm(`Esta empresa possui ${qtd} tarefa(s), que também serão excluídas. Continuar?`)) return;
      db.tarefas = db.tarefas.filter((t) => t.empresaId !== id);
      db.empresas = db.empresas.filter((x) => x.id !== id);
    }));
}

function renderEmpresas() {
  const linhas = [...db.empresas].sort((a, b) => a.nome.localeCompare(b.nome)).map((e) => {
    const ts = db.tarefas.filter((t) => t.empresaId === e.id);
    const abertas = ts.filter((t) => t.status !== 'concluida').length;
    const atrasadas = ts.filter(estaAtrasada).length;
    return `<tr class="clicavel" data-id="${e.id}">
      <td>${esc(e.nome)}</td><td>${esc(e.cnpj)}</td><td>${esc(e.regime)}</td>
      <td>${esc(db.membros.find((m) => m.id === e.responsavelId)?.nome ?? '')}</td>
      <td>${abertas}</td><td class="${atrasadas ? 'atrasada' : ''}">${atrasadas}</td>
      <td>${e.ativa === false ? 'Inativa' : 'Ativa'}</td></tr>`;
  });
  $('#lista-empresas').innerHTML = tabela(['Empresa', 'CNPJ', 'Regime', 'Responsável', 'Tarefas abertas', 'Atrasadas', 'Situação'], linhas, 'Nenhuma empresa cadastrada.');
}
$('#lista-empresas').addEventListener('click', (ev) => {
  const tr = ev.target.closest('tr[data-id]');
  if (tr) editarEmpresa(tr.dataset.id);
});
$('#btn-nova-empresa').addEventListener('click', () => editarEmpresa(null));

// ---------- Equipe ----------
const membrosAtivos = () => db.membros.filter((m) => m.ativo !== false).map((m) => ({ id: m.id, nome: m.nome }));

const camposMembro = () => [
  { nome: 'nome', rotulo: 'Nome', obrigatorio: true, full: true },
  { nome: 'cargo', rotulo: 'Cargo / posição' },
  { nome: 'departamento', rotulo: 'Departamento', tipo: 'select', vazio: '—', opcoes: DEPARTAMENTOS.map((d) => ({ id: d, nome: d })) },
  { nome: 'email', rotulo: 'E-mail', tipo: 'email' },
  { nome: 'telefone', rotulo: 'Telefone' },
  { nome: 'ativo', rotulo: 'Colaborador ativo', tipo: 'checkbox', padrao: true },
];

function editarMembro(id) {
  const m = db.membros.find((x) => x.id === id);
  abrirModal(m ? 'Editar colaborador' : 'Novo colaborador', camposMembro(), m || {},
    (d) => (m ? Object.assign(m, d) : db.membros.push({ id: novoId(), ...d })),
    m && (() => {
      // Tarefas do colaborador ficam sem responsável em vez de serem apagadas.
      db.tarefas.forEach((t) => { if (t.responsavelId === id) t.responsavelId = ''; });
      db.empresas.forEach((e) => { if (e.responsavelId === id) e.responsavelId = ''; });
      db.membros = db.membros.filter((x) => x.id !== id);
    }));
}

function renderEquipe() {
  const linhas = [...db.membros].sort((a, b) => a.nome.localeCompare(b.nome)).map((m) => {
    const ts = db.tarefas.filter((t) => t.responsavelId === m.id);
    const abertas = ts.filter((t) => t.status !== 'concluida').length;
    const empresas = db.empresas.filter((e) => e.responsavelId === m.id).length;
    return `<tr class="clicavel" data-id="${m.id}">
      <td>${esc(m.nome)}</td><td>${esc(m.cargo)}</td><td>${esc(m.departamento)}</td>
      <td>${esc(m.email)}</td><td>${empresas}</td><td>${abertas}</td>
      <td>${m.ativo === false ? 'Inativo' : 'Ativo'}</td></tr>`;
  });
  $('#lista-equipe').innerHTML = tabela(['Nome', 'Cargo', 'Departamento', 'E-mail', 'Empresas na carteira', 'Tarefas abertas', 'Situação'], linhas, 'Nenhum colaborador cadastrado.');
}
$('#lista-equipe').addEventListener('click', (ev) => {
  const tr = ev.target.closest('tr[data-id]');
  if (tr) editarMembro(tr.dataset.id);
});
$('#btn-novo-membro').addEventListener('click', () => editarMembro(null));

// ---------- Tarefas ----------
const camposTarefa = () => [
  { nome: 'titulo', rotulo: 'Tarefa', obrigatorio: true, full: true },
  { nome: 'empresaId', rotulo: 'Empresa', tipo: 'select', vazio: '— Interna / sem empresa —', opcoes: db.empresas.map((e) => ({ id: e.id, nome: e.nome })) },
  { nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select', vazio: '— Sem responsável —', opcoes: membrosAtivos() },
  { nome: 'departamento', rotulo: 'Departamento', tipo: 'select', vazio: '—', opcoes: DEPARTAMENTOS.map((d) => ({ id: d, nome: d })) },
  { nome: 'competencia', rotulo: 'Competência', tipo: 'month', padrao: hoje().slice(0, 7) },
  { nome: 'prazo', rotulo: 'Prazo', tipo: 'date' },
  { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', opcoes: PRIORIDADES, padrao: 'media' },
  { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: STATUS, padrao: 'pendente' },
  { nome: 'progresso', rotulo: 'Progresso (%)', tipo: 'number', padrao: 0 },
  { nome: 'recorrente', rotulo: 'Tarefa mensal recorrente', tipo: 'checkbox' },
  { nome: 'observacoes', rotulo: 'Observações / posição atual', tipo: 'textarea', full: true },
];

function aplicarStatus(t, status) {
  t.status = status;
  if (status === 'concluida') {
    t.progresso = 100;
    t.concluidaEm = t.concluidaEm || hoje();
  } else {
    t.concluidaEm = '';
    if (t.progresso >= 100) t.progresso = 90;
  }
  t.atualizadaEm = hoje();
}

function editarTarefa(id) {
  const t = db.tarefas.find((x) => x.id === id);
  abrirModal(t ? 'Editar tarefa' : 'Nova tarefa', camposTarefa(), t || {},
    (d) => {
      const alvo = t || { id: novoId(), criadaEm: hoje() };
      const status = d.status;
      Object.assign(alvo, d, { progresso: Math.max(0, Math.min(100, d.progresso || 0)) });
      aplicarStatus(alvo, status);
      if (!t) db.tarefas.push(alvo);
    },
    t && (() => { db.tarefas = db.tarefas.filter((x) => x.id !== id); }));
}

function filtrarTarefas({ empresa, responsavel, status, departamento, competencia, busca }) {
  const termo = (busca || '').toLowerCase();
  return db.tarefas.filter((t) =>
    (!empresa || t.empresaId === empresa) &&
    (!responsavel || (responsavel === '_sem' ? !t.responsavelId : t.responsavelId === responsavel)) &&
    (!status || (status === '_atrasada' ? estaAtrasada(t) : status === '_abertas' ? t.status !== 'concluida' : t.status === status)) &&
    (!departamento || t.departamento === departamento) &&
    (!competencia || t.competencia === competencia) &&
    (!termo || (t.titulo + ' ' + (t.observacoes || '')).toLowerCase().includes(termo)));
}

const ordemPrioridade = { alta: 0, media: 1, baixa: 2 };
function ordenarTarefas(lista) {
  return lista.sort((a, b) =>
    (a.status === 'concluida') - (b.status === 'concluida') ||
    (a.prazo || '9999').localeCompare(b.prazo || '9999') ||
    ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade]);
}

function linhaTarefa(t) {
  const atrasada = estaAtrasada(t);
  return `<tr class="clicavel" data-id="${t.id}">
    <td class="wrap">${esc(t.titulo)}${t.recorrente ? ' <span title="Recorrente">↻</span>' : ''}</td>
    <td>${esc(nomeEmpresa(t.empresaId))}</td>
    <td>${esc(nomeMembro(t.responsavelId))}</td>
    <td>${esc(t.departamento)}</td>
    <td>${fmtCompetencia(t.competencia)}</td>
    <td class="${atrasada ? 'atrasada' : ''}">${fmtData(t.prazo)}${atrasada ? ' (atrasada)' : ''}</td>
    <td class="pr-${t.prioridade}">${nomePrioridade(t.prioridade)}</td>
    <td>${badgeStatus(t.status)}</td>
    <td>${barra(t.progresso || 0)}</td>
    <td class="wrap">${esc(t.observacoes)}</td></tr>`;
}
const colunasTarefa = ['Tarefa', 'Empresa', 'Responsável', 'Depto.', 'Comp.', 'Prazo', 'Prioridade', 'Status', 'Progresso', 'Posição atual'];

function renderTarefas() {
  const lista = ordenarTarefas(filtrarTarefas({
    empresa: $('#f-empresa').value,
    responsavel: $('#f-responsavel').value,
    status: $('#f-status').value,
    departamento: $('#f-departamento').value,
    competencia: $('#f-competencia').value,
    busca: $('#f-busca').value,
  }));
  $('#lista-tarefas').innerHTML = tabela(colunasTarefa, lista.map(linhaTarefa), 'Nenhuma tarefa encontrada.');
}
['#f-busca', '#f-empresa', '#f-responsavel', '#f-status', '#f-departamento', '#f-competencia']
  .forEach((s) => $(s).addEventListener('input', renderTarefas));
$('#lista-tarefas').addEventListener('click', (ev) => {
  const tr = ev.target.closest('tr[data-id]');
  if (tr) editarTarefa(tr.dataset.id);
});
$('#btn-nova-tarefa').addEventListener('click', () => editarTarefa(null));

// Cria, para a competência seguinte, uma cópia de cada tarefa recorrente da competência base.
$('#btn-gerar-recorrentes').addEventListener('click', () => {
  const recorrentes = db.tarefas.filter((t) => t.recorrente && t.competencia);
  if (!recorrentes.length) return alert('Não há tarefas marcadas como recorrentes.');
  const base = $('#f-competencia').value || recorrentes.map((t) => t.competencia).sort().pop();
  const destino = proximaCompetencia(base);
  const existe = (t) => db.tarefas.some((x) =>
    x.competencia === destino && x.titulo === t.titulo && x.empresaId === t.empresaId);
  const novas = recorrentes.filter((t) => t.competencia === base && !existe(t));
  if (!novas.length) return alert(`Nada a gerar: as recorrentes de ${fmtCompetencia(base)} já existem em ${fmtCompetencia(destino)}.`);
  if (!confirm(`Gerar ${novas.length} tarefa(s) de ${fmtCompetencia(base)} para ${fmtCompetencia(destino)}?`)) return;
  novas.forEach((t) => db.tarefas.push({
    ...t, id: novoId(), competencia: destino, prazo: somarUmMes(t.prazo),
    status: 'pendente', progresso: 0, concluidaEm: '', observacoes: '', criadaEm: hoje(), atualizadaEm: hoje(),
  }));
  $('#f-competencia').value = destino;
  salvar();
});

// ---------- Quadro (kanban) ----------
function renderQuadro() {
  const lista = ordenarTarefas(filtrarTarefas({
    empresa: $('#q-empresa').value,
    responsavel: $('#q-responsavel').value,
    competencia: $('#q-competencia').value,
  }));
  $('#quadro').innerHTML = STATUS.map((s) => {
    const ts = lista.filter((t) => t.status === s.id);
    return `<div class="coluna" data-status="${s.id}">
      <h3><span>${s.nome}</span><span>${ts.length}</span></h3>
      ${ts.map((t) => `<div class="cartao" draggable="true" data-id="${t.id}">
        <div class="t">${esc(t.titulo)}</div>
        <div class="m">${esc(nomeEmpresa(t.empresaId))}</div>
        <div class="m">${esc(nomeMembro(t.responsavelId))} · <span class="pr-${t.prioridade}">${nomePrioridade(t.prioridade)}</span></div>
        <div class="m ${estaAtrasada(t) ? 'atrasada' : ''}">${t.prazo ? 'Prazo ' + fmtData(t.prazo) : ''}</div>
        ${barra(t.progresso || 0)}
      </div>`).join('')}
    </div>`;
  }).join('');
}
['#q-empresa', '#q-responsavel', '#q-competencia'].forEach((s) => $(s).addEventListener('input', renderQuadro));

const quadro = $('#quadro');
quadro.addEventListener('click', (ev) => {
  const c = ev.target.closest('.cartao');
  if (c) editarTarefa(c.dataset.id);
});
quadro.addEventListener('dragstart', (ev) => {
  const c = ev.target.closest('.cartao');
  if (c) ev.dataTransfer.setData('text/plain', c.dataset.id);
});
quadro.addEventListener('dragover', (ev) => {
  const col = ev.target.closest('.coluna');
  if (!col) return;
  ev.preventDefault();
  quadro.querySelectorAll('.coluna').forEach((c) => c.classList.toggle('drop', c === col));
});
quadro.addEventListener('dragleave', (ev) => {
  if (!quadro.contains(ev.relatedTarget)) quadro.querySelectorAll('.coluna').forEach((c) => c.classList.remove('drop'));
});
quadro.addEventListener('drop', (ev) => {
  const col = ev.target.closest('.coluna');
  if (!col) return;
  ev.preventDefault();
  const t = db.tarefas.find((x) => x.id === ev.dataTransfer.getData('text/plain'));
  if (t && t.status !== col.dataset.status) {
    aplicarStatus(t, col.dataset.status);
    salvar();
  } else {
    renderQuadro();
  }
});

// ---------- Painel ----------
function resumo(ts) {
  const total = ts.length;
  const concluidas = ts.filter((t) => t.status === 'concluida').length;
  return {
    total,
    concluidas,
    andamento: ts.filter((t) => t.status === 'andamento' || t.status === 'revisao').length,
    pendentes: ts.filter((t) => t.status === 'pendente').length,
    bloqueadas: ts.filter((t) => t.status === 'bloqueada').length,
    atrasadas: ts.filter(estaAtrasada).length,
    pct: total ? Math.round((concluidas / total) * 100) : 0,
  };
}

function linhaResumo(nome, r) {
  return `<tr><td>${esc(nome)}</td><td>${r.total}</td><td>${r.pendentes}</td><td>${r.andamento}</td>
    <td>${r.bloqueadas}</td><td>${r.concluidas}</td><td class="${r.atrasadas ? 'atrasada' : ''}">${r.atrasadas}</td>
    <td>${barra(r.pct)} ${r.pct}%</td></tr>`;
}
const colunasResumo = ['', 'Total', 'Pendentes', 'Em andamento', 'Bloqueadas', 'Concluídas', 'Atrasadas', '% concluído'];

function renderPainel() {
  const comp = $('#painel-competencia').value;
  const ts = db.tarefas.filter((t) => !comp || t.competencia === comp);
  const r = resumo(ts);

  $('#kpis').innerHTML = [
    ['Tarefas', r.total], ['Pendentes', r.pendentes], ['Em andamento', r.andamento],
    ['Bloqueadas', r.bloqueadas], ['Concluídas', r.concluidas], ['Atrasadas', r.atrasadas], ['% concluído', r.pct + '%'],
  ].map(([rot, val]) => `<div class="kpi"><div class="valor">${val}</div><div class="rotulo">${rot}</div></div>`).join('');

  const porMembro = db.membros.map((m) => [m.nome + (m.cargo ? ` — ${m.cargo}` : ''), resumo(ts.filter((t) => t.responsavelId === m.id))]);
  const semResp = ts.filter((t) => !t.responsavelId);
  if (semResp.length) porMembro.push(['Sem responsável', resumo(semResp)]);
  $('#posicao-equipe').innerHTML = tabela(
    ['Colaborador', ...colunasResumo.slice(1)],
    porMembro.filter(([, x]) => x.total).sort((a, b) => b[1].atrasadas - a[1].atrasadas || b[1].total - a[1].total).map(([n, x]) => linhaResumo(n, x)),
    'Sem tarefas no período.');

  const porEmpresa = db.empresas.map((e) => [e.nome, resumo(ts.filter((t) => t.empresaId === e.id))]);
  const internas = ts.filter((t) => !t.empresaId);
  if (internas.length) porEmpresa.push(['Interna / sem empresa', resumo(internas)]);
  $('#posicao-empresas').innerHTML = tabela(
    ['Empresa', ...colunasResumo.slice(1)],
    porEmpresa.filter(([, x]) => x.total).sort((a, b) => a[1].pct - b[1].pct).map(([n, x]) => linhaResumo(n, x)),
    'Sem tarefas no período.');

  const alertas = ordenarTarefas(ts.filter((t) => t.status !== 'concluida' && t.prazo && diasAte(t.prazo) <= 3));
  $('#alertas').innerHTML = tabela(colunasTarefa, alertas.map(linhaTarefa), 'Nenhuma tarefa atrasada ou vencendo nos próximos 3 dias.');
}
$('#painel-competencia').addEventListener('input', renderPainel);
$('#alertas').addEventListener('click', (ev) => {
  const tr = ev.target.closest('tr[data-id]');
  if (tr) editarTarefa(tr.dataset.id);
});

// ---------- Dados: exportar / importar ----------
function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  a.click();
  URL.revokeObjectURL(url);
}

$('#btn-exportar').addEventListener('click', () =>
  baixar(`controle-equipe-${hoje()}.json`, JSON.stringify(db, null, 2), 'application/json'));

$('#btn-exportar-csv').addEventListener('click', () => {
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = ['Tarefa', 'Empresa', 'Responsável', 'Departamento', 'Competência', 'Prazo', 'Prioridade', 'Status', 'Progresso', 'Atrasada', 'Concluída em', 'Observações'];
  const linhas = ordenarTarefas([...db.tarefas]).map((t) => [
    t.titulo, nomeEmpresa(t.empresaId), nomeMembro(t.responsavelId), t.departamento, fmtCompetencia(t.competencia),
    fmtData(t.prazo), nomePrioridade(t.prioridade), nomeStatus(t.status), (t.progresso || 0) + '%',
    estaAtrasada(t) ? 'Sim' : 'Não', fmtData(t.concluidaEm), t.observacoes,
  ].map(cel).join(';'));
  // BOM para o Excel reconhecer acentuação.
  baixar(`tarefas-${hoje()}.csv`, '﻿' + [cab.map(cel).join(';'), ...linhas].join('\r\n'), 'text/csv');
});

$('#inp-importar').addEventListener('change', async (ev) => {
  const arq = ev.target.files[0];
  ev.target.value = '';
  if (!arq) return;
  try {
    const dados = normalizar(JSON.parse(await arq.text()));
    if (!confirm(`Importar ${dados.empresas.length} empresa(s), ${dados.membros.length} colaborador(es) e ${dados.tarefas.length} tarefa(s)? Os dados atuais serão substituídos.`)) return;
    db = dados;
    salvar();
  } catch (e) {
    alert('Arquivo inválido: ' + e.message);
  }
});

$('#btn-limpar').addEventListener('click', () => {
  if (!confirm('Apagar todos os dados? Exporte um backup antes, se necessário.')) return;
  db = { empresas: [], membros: [], tarefas: [] };
  salvar();
});

$('#btn-exemplo').addEventListener('click', () => {
  if ((db.empresas.length || db.tarefas.length) && !confirm('Substituir os dados atuais pelos dados de exemplo?')) return;
  db = dadosExemplo();
  salvar();
});

function dadosExemplo() {
  const comp = hoje().slice(0, 7);
  const dia = (d) => `${comp}-${String(d).padStart(2, '0')}`;
  const m = [
    { id: 'm1', nome: 'Ana Souza', cargo: 'Coordenadora', departamento: 'Contábil', ativo: true },
    { id: 'm2', nome: 'Bruno Lima', cargo: 'Analista fiscal', departamento: 'Fiscal', ativo: true },
    { id: 'm3', nome: 'Carla Dias', cargo: 'Analista de DP', departamento: 'Pessoal', ativo: true },
  ];
  const e = [
    { id: 'e1', nome: 'Alfa Comércio Ltda', regime: 'Lucro Presumido', responsavelId: 'm1', ativa: true },
    { id: 'e2', nome: 'Beta Serviços ME', regime: 'Simples Nacional', responsavelId: 'm2', ativa: true },
    { id: 'e3', nome: 'Gama Indústria S/A', regime: 'Lucro Real', responsavelId: 'm1', ativa: true },
  ];
  const base = { competencia: comp, recorrente: true, criadaEm: hoje(), observacoes: '' };
  const t = [
    { titulo: 'Folha de pagamento', empresaId: 'e1', responsavelId: 'm3', departamento: 'Pessoal', prazo: dia(5), prioridade: 'alta', status: 'concluida', progresso: 100 },
    { titulo: 'Apuração ICMS', empresaId: 'e1', responsavelId: 'm2', departamento: 'Fiscal', prazo: dia(10), prioridade: 'alta', status: 'andamento', progresso: 50, observacoes: 'Aguardando XML de 3 notas.' },
    { titulo: 'DAS Simples Nacional', empresaId: 'e2', responsavelId: 'm2', departamento: 'Fiscal', prazo: dia(20), prioridade: 'alta', status: 'pendente', progresso: 0 },
    { titulo: 'Conciliação bancária', empresaId: 'e3', responsavelId: 'm1', departamento: 'Contábil', prazo: dia(25), prioridade: 'media', status: 'revisao', progresso: 80 },
    { titulo: 'Lançamentos do extrato', empresaId: 'e2', responsavelId: 'm1', departamento: 'Contábil', prazo: dia(15), prioridade: 'media', status: 'bloqueada', progresso: 20, observacoes: 'Cliente não enviou extrato.' },
    { titulo: 'Folha de pagamento', empresaId: 'e3', responsavelId: 'm3', departamento: 'Pessoal', prazo: dia(5), prioridade: 'alta', status: 'andamento', progresso: 60 },
  ].map((x) => ({ ...base, ...x, id: novoId(), concluidaEm: x.status === 'concluida' ? hoje() : '' }));
  return { empresas: e, membros: m, tarefas: t };
}

// ---------- Render geral ----------
function atualizarFiltros() {
  const empresas = [...db.empresas].sort((a, b) => a.nome.localeCompare(b.nome)).map((e) => ({ id: e.id, nome: e.nome }));
  const membros = [...db.membros].sort((a, b) => a.nome.localeCompare(b.nome)).map((x) => ({ id: x.id, nome: x.nome }));
  const membrosComSem = [...membros, { id: '_sem', nome: 'Sem responsável' }];
  preencherSelect($('#f-empresa'), empresas, 'Todas as empresas');
  preencherSelect($('#q-empresa'), empresas, 'Todas as empresas');
  preencherSelect($('#f-responsavel'), membrosComSem, 'Todos os responsáveis');
  preencherSelect($('#q-responsavel'), membrosComSem, 'Todos os responsáveis');
  preencherSelect($('#f-status'), [{ id: '_abertas', nome: 'Abertas (não concluídas)' }, { id: '_atrasada', nome: 'Atrasadas' }, ...STATUS], 'Todos os status');
  preencherSelect($('#f-departamento'), DEPARTAMENTOS.map((d) => ({ id: d, nome: d })), 'Todos os departamentos');
}

function renderizar() {
  atualizarFiltros();
  renderPainel();
  renderTarefas();
  renderQuadro();
  renderEquipe();
  renderEmpresas();
}

renderizar();
