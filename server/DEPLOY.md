# Publicar o servidor gratuito

O servidor fornece contas de jogador, lista de amigos e salas de batalha por WebSocket. O mesmo transporte funciona no iPhone, Android e navegador.

## 1. Criar o banco PostgreSQL

1. Crie uma conta gratuita no [Neon](https://neon.tech/) e um projeto PostgreSQL.
2. Copie a connection string **pooled** do painel do Neon. Ela deve incluir SSL.
3. Mantenha essa string privada; não a salve no repositório.

O plano gratuito do Neon é permanente, mas limita armazenamento e suspende o banco quando fica ocioso. A primeira conexão depois de uma pausa pode demorar.

## 2. Publicar a API e as partidas

1. Crie uma conta no [Render](https://render.com/) e conecte o repositório `leohamil31/tycoon-game-`.
2. Escolha **New > Blueprint** e selecione esse repositório. O Render usará o arquivo `render.yaml` da raiz para criar o serviço gratuito `tycoon-game-api-leohamil31`.
3. Quando solicitado, informe a connection string do Neon no campo `DATABASE_URL`.
4. Aguarde o deploy e confirme que `https://tycoon-game-api-leohamil31.onrender.com/api/health` retorna `{"ok":true}`.

Se o nome do serviço precisar mudar, atualize também `DEFAULT_API_URL` em `../src/services/api.ts` com a URL `.onrender.com` escolhida.

## 3. Conectar e atualizar os clientes

As versões de produção usam a URL configurada em `DEFAULT_API_URL`. O servidor cria automaticamente a conta do jogador na primeira abertura. Para jogar com alguém, adicionem-se pelo código de amigo de 8 caracteres; depois, o anfitrião cria uma sala e compartilha o código de 5 caracteres.

Uma mudança de servidor exige publicar uma nova versão dos aplicativos iOS/Android. O site precisa ser recompilado e publicado para usar a API.

## Limites do plano gratuito

O Render gratuito pode suspender a API após inatividade; o primeiro acesso pode levar cerca de um minuto. O Neon também pausa o banco ocioso. O plano gratuito é para projetos pessoais/testes e não oferece garantia de disponibilidade ou backups de produção. O Render informa uma cota mensal de horas gratuitas e o serviço pode reiniciar; partidas em andamento são encerradas nesses casos.
