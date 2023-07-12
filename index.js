import { object, string, number } from "yup";
import fetch from "node-fetch";

export const handler = async (event, context) => {
  const schema = object().shape({
    phone: string().required(),
    email: string().email().required(),
    fullName: string().required(),
    zip: string().length(8).required(),
    energyConsumption: number().min(0.0).required(),
    creci: string().required(),
  });

  const {
    PIPEFY_AUTH_TOKEN,
    PIPEFY_API_URL,
    PIPEFY_CONSUMIDORES_TABLE_ID,
    PIPEFY_CORRETORES_TABLE_ID,
    PIPEFY_VENDAS_PIPE_ID,
  } = process.env;

  const buildResponse = (code, body) => {
    return {
      statusCode: code,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    };
  };

  const getPhoneNumber = (phone) => {
    phone = phone.replace(/[^0-9]/g, "");
    if (phone.length <= 11) {
      phone = `55${phone}`;
    }

    return `+${phone.substr(0, 2)} ${phone.substr(2, 2)} ${phone.substr(
      4,
      5
    )}-${phone.substr(9)}`;
  };

  const findCustomer = async (phone) => {
    return await findRecord(
      PIPEFY_CONSUMIDORES_TABLE_ID,
      `{ fieldId: "telefone" fieldValue: "${phone}" }`
    );
  };

  const findSalesAgent = async (creci) => {
    return await findRecord(
      PIPEFY_CORRETORES_TABLE_ID,
      `{ fieldId: "creci" fieldValue: "${creci}" }`
    );
  };

  const findRecord = async (tableId, search) => {
    const query = `{
        findRecords(
          tableId: "${tableId}"
          search: ${search}
        ) {
          edges {
            node {
              id
            }
          }
        }
      }`;

    console.log("[findRecord] request: ", JSON.stringify({ query }));
    console.log({ query });
    const findRecordResponse = await fetch(PIPEFY_API_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${PIPEFY_AUTH_TOKEN}`,
      },
    });
    const findRecordResult = await findRecordResponse.json();
    console.log(`[findRecord] response: ${JSON.stringify(findRecordResult)}`);

    if (findRecordResult.errors) {
      console.error("Failed to fetch record");

      throw buildResponse(500, {
        errors: findRecordResult.errors,
      });
    }

    return (
      findRecordResult.data.findRecords.edges
        .map((edge) => edge?.node)
        .shift() || {}
    );
  };

  const createCustomer = async (data) => {
    return await createRecord(
      PIPEFY_CONSUMIDORES_TABLE_ID,
      `[
          {
            field_id: "e_mail",
            field_value: "${params.email}",
          },
          {
            field_id: "telefone",
            field_value: "${params.phone}",
          },
          {
            field_id: "nome",
            field_value: "${params.fullName}",
          },
          {
            field_id: "cep",
            field_value: "${params.zip}",
          },
          {
            field_id: "consumo_m_dio_de_energia",
            field_value: "${params.energyConsumption}",
          },
          {
            field_id: "corretor",
            field_value: "${salesAgent.id}",
          },
        ]`
    );
  };

  const createRecord = async (tableId, data) => {
    const mutation = `
    mutation {
      createTableRecord(input: {
        table_id: "${tableId}",
        fields_attributes: ${data}
      }){
          table_record { id }
      }
    }`;

    console.log("[createRecord] request: ", JSON.stringify({ mutation }));
    const response = await fetch(PIPEFY_API_URL, {
      method: "POST",
      body: JSON.stringify({ query: mutation }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${PIPEFY_AUTH_TOKEN}`,
      },
    });

    const json = await response.json();
    console.log(`[createRecord] response: ${JSON.stringify(json)}`);

    if (json.errors) {
      throw buildResponse(500, {
        errors: json.errors,
      });
    }

    return json.data.createTableRecord.table_record;
  };

  const findCard = async (pipeId, search) => {
    const query = `{
      findCards(pipeId: "${pipeId}",
        search: ${search}
      ) {
        edges {
        node {
          id
          summary {
              title,
              value
          }
          title
          fields {
            name
            value
            field { id }
          }
          url
          current_phase { id name }
        }
      }
    }
    }`;

    console.log("[findCard] request: ", JSON.stringify({ query }));
    const response = await fetch(PIPEFY_API_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${PIPEFY_AUTH_TOKEN}`,
      },
    });
    const result = await response.json();
    console.log(`[findCard] response: ${JSON.stringify(result)}`);

    if (result.errors) {
      console.error("Failed to fetch record");

      throw buildResponse(500, {
        errors: result.errors,
      });
    }

    return result.data.findCards.edges.map((edge) => edge?.node).shift() || {};
  };

  const createSalesCard = async (customer, salesAgent) => {
    return await createCard(
      PIPEFY_VENDAS_PIPE_ID,
      `[
        {
          field_id: "consumidor",
          field_value: ${customer.id}
        },
        {
          field_id: "corretor",
          field_value: "${salesAgent.id}"
        }
      ]`
    );
  };

  const createCard = async (pipeId, attributes) => {
    const query = `mutation {
      createCard(input: {
          pipe_id: ${pipeId},
          fields_attributes: ${attributes}
      }) {
          card { id }
      }
  }`;

    console.log("[createCard] request: ", JSON.stringify({ query }));
    const resp = await fetch(PIPEFY_API_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${PIPEFY_AUTH_TOKEN}`,
      },
    });

    const json = await resp.json();
    console.log(`[createCard] response: ${JSON.stringify(json)}`);

    return json.data.createCard.card;
  };

  let body;
  try {
    console.log("Event body:", event.body);
    body = JSON.parse(event.body);
  } catch (error) {
    console.error("Failed to parse request body", error);
    return buildResponse(400, {
      errors: [
        {
          message: "Failed to parse request body",
        },
      ],
    });
  }

  let params;
  try {
    params = await schema.validate(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    console.error("Validation failed", error);
    return buildResponse(400, { errors: error.errors });
  }

  params.phone = getPhoneNumber(params.phone);

  const response = {};

  let salesAgent;
  try {
    salesAgent = await findSalesAgent(params.creci);
    response.salesAgent = salesAgent;
  } catch (error) {
    console.error(
      `Failed to find sales agent with creci ${params.creci}`,
      error
    );
    return error;
  }

  if (!salesAgent.id) {
    return buildResponse(404, {
      errors: [
        {
          message: `Não foi possível localizar um corretor cadastrado com o CRECI ${params.creci} `,
        },
      ],
    });
  }

  let customer;
  try {
    customer = await findCustomer(params.phone);
    console.log(JSON.stringify(customer));
  } catch (error) {
    console.error(`Failed to find customer with phone ${params.phone}`, error);
    return error;
  }

  if (customer.id) {
    console.log("Consumidor já existe.");
  } else {
    console.log("Cria consumidor");
    try {
      customer = await createCustomer(params);
      response.customer = customer;
    } catch (error) {
      console.log("Failed to create customer record", error);
      return error;
    }
  }

  let card;
  try {
    console.log("Verifica se já existe um card");
    card = await findCard(
      PIPEFY_VENDAS_PIPE_ID,
      `{
            fieldId: "consumidor"
            fieldValue: "${customer.id}"
        }`
    );
  } catch (error) {
    console.log("Failed to find card", error);
    return error;
  }

  if (card.id) {
    console.log(
      `Já existe um card para o consumidor ${params.phone}(${customer.id}) com o id: ${card.id}`
    );
    // Erro ou atualiza?
    return buildResponse(409, {
      errors: [
        {
          message:
            "A solicitação já foi registrada. Por favor, aguarde nosso contato",
        },
      ],
    });
  }

  try {
    const card = await createSalesCard(customer, salesAgent);
    response.card = card;
  } catch (error) {
    console.log("Failed to create sales card", error);
    return error;
  }

  return buildResponse(202, response);
};
