/**
 * Cria o primeiro administrador (substitui a antiga edge function bootstrap-admin).
 *
 *   SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='Senha#Forte1' SEED_ADMIN_NAME='Administrador' npm run db:seed
 *
 * Só cria se ainda não existir nenhum administrador.
 */
import { hashPassword } from "../server/lib/auth.js";
import { db } from "../server/lib/db.js";

const username = (process.env.SEED_ADMIN_USERNAME || "").trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || "";
const fullName = process.env.SEED_ADMIN_NAME || "Administrador";
const email = process.env.SEED_ADMIN_EMAIL || `${username}@engemase.local`;

async function main() {
  const existing = await db.profiles.count({ where: { role: "admin" } });
  if (existing > 0) {
    console.log("Já existe administrador — nada a fazer.");
    return;
  }
  if (!/^[a-z0-9.]{3,30}$/.test(username) || password.length < 8) {
    throw new Error("Defina SEED_ADMIN_USERNAME (3-30 caracteres a-z0-9.) e SEED_ADMIN_PASSWORD (mín. 8)");
  }
  const admin = await db.profiles.create({
    data: {
      username,
      email,
      full_name: fullName,
      role: "admin",
      category: "engemase_employee",
      approved: true,
      first_login: false,
      password_hash: await hashPassword(password),
    },
  });
  console.log(`Administrador criado: ${admin.username} (${admin.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
