# Controle de Equipe e Empresas

Sistema web simples para acompanhar as tarefas da equipe por empresa (cliente) e a posição de cada uma.
Não precisa de instalação nem de servidor: basta abrir o `index.html` no navegador.

## Funcionalidades

- **Painel**: indicadores gerais (pendentes, em andamento, bloqueadas, concluídas, atrasadas, % concluído),
  posição por colaborador, posição por empresa e lista de tarefas atrasadas ou vencendo em 3 dias.
  Pode ser filtrado por competência (mês).
- **Tarefas**: cadastro com empresa, responsável, departamento, competência, prazo, prioridade, status,
  progresso (%) e observações sobre a posição atual. Filtros por empresa, responsável, status, departamento,
  competência e busca por texto.
- **Tarefas recorrentes**: marque como "recorrente" e use *Gerar recorrentes da próxima competência* para
  criar automaticamente as tarefas do mês seguinte (prazo avançado em um mês).
- **Quadro**: visão kanban por status; arraste os cartões para mudar o status.
- **Equipe**: colaboradores com cargo/posição, departamento e carteira de empresas.
- **Empresas**: cadastro com CNPJ, regime tributário e responsável pela carteira.
- **Dados**: exportação/importação em JSON (backup), exportação das tarefas em CSV (abre no Excel) e
  carga de dados de exemplo.

## Armazenamento

Os dados ficam salvos no `localStorage` do navegador em que o sistema é usado. Para não perder informações
ou para levar os dados a outro computador, use **Dados → Exportar JSON** e depois **Importar JSON**.
