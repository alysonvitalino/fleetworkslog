// CLI de banco: `npm run db:migrate | db:rollback | db:seed | db:status | db:make -- <nome>`
// Usamos a API do Knex direto em vez do CLI oficial, que não lida bem com TS + ESM.
import { createKnex } from './knex.js';

const [command, ...args] = process.argv.slice(2);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL não definida (veja backend/.env.example)');
  process.exit(1);
}

const knex = createKnex(databaseUrl);

async function run() {
  switch (command) {
    case 'migrate': {
      const [batch, files] = await knex.migrate.latest();
      console.log(
        files.length ? `Batch ${batch}: ${files.join(', ')}` : 'Nenhuma migration pendente',
      );
      break;
    }
    case 'rollback': {
      const [batch, files] = await knex.migrate.rollback();
      console.log(
        files.length ? `Revertido batch ${batch}: ${files.join(', ')}` : 'Nada a reverter',
      );
      break;
    }
    case 'seed': {
      const [files] = await knex.seed.run();
      console.log(files.length ? `Seeds: ${files.join(', ')}` : 'Nenhum seed encontrado');
      break;
    }
    case 'status': {
      const [completed, pending] = await knex.migrate.list();
      console.log(`Aplicadas: ${completed.length} | Pendentes: ${pending.length}`);
      for (const migration of pending) console.log(`  pendente: ${migration.file}`);
      break;
    }
    case 'make': {
      const name = args[0];
      if (!name) throw new Error('Informe o nome: npm run db:make -- create_users');
      console.log(`Criada: ${await knex.migrate.make(name)}`);
      break;
    }
    default:
      throw new Error(`Comando desconhecido: ${command ?? '(vazio)'}`);
  }
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => knex.destroy());
