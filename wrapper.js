import * as dotenv from "dotenv";
dotenv.config();
import { handler } from "./index.js";

(async () => {
  const event = {
    body: JSON.stringify({
      phone: "+5519997265355",
      email: "oliveira.gabriel07@gmail.com",
      fullName: "Gabriel Oliveira",
      zip: "01141000",
      energyConsumption: 150.0,
      creci: "123456",
    }),
  };

  const result = await handler(event);
  console.log(`result: ${JSON.stringify(result)}`);
})();

// TODOS:
// 1) Quem somos
// # QUEM SOMOS
// Somos uma plataforma que conecta os integradores de energia solar a potenciais clientes de maneira rápida e prática por meio de parceiros estratégicos.
// Existimos para descomplicar a energia solar e aproveitar as oportunidades para levar energia limpa, renovável e com custo baixo.

// 2) Arrumar a home

// 3)