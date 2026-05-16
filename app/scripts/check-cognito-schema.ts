/**
 * scripts/check-cognito-schema.ts
 *
 * Verifica se o atributo custom:teamId está presente no schema do Cognito User Pool.
 * Uso em CI: exit code 0 = atributo presente e válido; exit code 1 = ausente ou inválido.
 *
 * Execução:
 *   npx ts-node --project scripts/tsconfig.json scripts/check-cognito-schema.ts
 */

import { execSync } from "child_process";

const USER_POOL_ID = "us-east-1_cHokaMBWW";

interface SchemaAttribute {
  Name: string;
  AttributeDataType: string;
  Mutable: boolean;
  Required?: boolean;
  StringAttributeConstraints?: {
    MinLength?: string;
    MaxLength?: string;
  };
}

interface UserPool {
  SchemaAttributes: SchemaAttribute[];
}

interface DescribeUserPoolOutput {
  UserPool: UserPool;
}

function main(): void {
  console.log(`Verificando schema do User Pool: ${USER_POOL_ID}`);

  let output: string;
  try {
    output = execSync(
      `aws cognito-idp describe-user-pool --user-pool-id ${USER_POOL_ID}`,
      { encoding: "utf-8" },
    );
  } catch (err) {
    console.error("ERRO: Falha ao chamar AWS CLI.");
    console.error(
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  let parsed: DescribeUserPoolOutput;
  try {
    parsed = JSON.parse(output) as DescribeUserPoolOutput;
  } catch {
    console.error("ERRO: Não foi possível parsear a resposta da AWS CLI.");
    process.exit(1);
  }

  const schema: SchemaAttribute[] = parsed?.UserPool?.SchemaAttributes ?? [];

  const teamIdAttr = schema.find((attr) => attr.Name === "custom:teamId");

  if (!teamIdAttr) {
    console.error(
      "FALHA: Atributo 'custom:teamId' NÃO encontrado no schema do User Pool.",
    );
    console.error(
      "  → Execute: aws cognito-idp add-custom-attributes --user-pool-id " +
        USER_POOL_ID +
        " --custom-attributes '[{\"Name\":\"teamId\",\"AttributeDataType\":\"String\",\"Mutable\":true,\"Required\":false}]'",
    );
    process.exit(1);
  }

  const errors: string[] = [];

  if (teamIdAttr.AttributeDataType !== "String") {
    errors.push(
      `  → AttributeDataType esperado: 'String', encontrado: '${teamIdAttr.AttributeDataType}'`,
    );
  }

  if (teamIdAttr.Mutable !== true) {
    errors.push(
      `  → Mutable esperado: true, encontrado: ${teamIdAttr.Mutable}`,
    );
  }

  if (errors.length > 0) {
    console.error(
      "FALHA: Atributo 'custom:teamId' encontrado mas com propriedades incorretas:",
    );
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }

  console.log("OK: Atributo 'custom:teamId' presente e válido no schema.");
  console.log(`  Name:              ${teamIdAttr.Name}`);
  console.log(`  AttributeDataType: ${teamIdAttr.AttributeDataType}`);
  console.log(`  Mutable:           ${teamIdAttr.Mutable}`);
  process.exit(0);
}

main();
