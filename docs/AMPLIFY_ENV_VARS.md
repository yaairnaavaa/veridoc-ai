# Variables de entorno para AWS Amplify

## Dónde configurarlas (importante)

- **Variables normales:** **Amplify Console** → **Hosting** → **Environment variables** → **Manage variables**.  
  Ahí añades clave y valor. Esas variables **sí** están disponibles en el build y el `amplify.yml` las vuelca a `.env.production`.

- **No** uses solo "App settings" si en tu consola hay **Hosting** → **Environment variables**: tienen que estar en **Hosting** para el frontend/Next.js.

- **Si usas Secrets (Parameter Store):** entonces no aparecen en el `env` del build. El `amplify.yml` tiene un fallback que las lee de `/amplify/{App ID}/{Branch}/NOMBRE_VARIABLE`. Crea los parámetros en **Systems Manager** → **Parameter Store** con ese path (o usa las variables normales arriba).

## Requeridas para NEAR (faucet + relayer)

| Variable | Uso |
|----------|-----|
| `NEAR_FAUCET_ACCOUNT_ID` | Cuenta que financia la activación de cuentas nuevas |
| `NEAR_FAUCET_PRIVATE_KEY` | Clave privada del faucet (formato `ed25519:...`) |
| `NEAR_RELAYER_ACCOUNT_ID` | Cuenta relayer que paga gas en retiros USDT |
| `NEAR_RELAYER_PRIVATE_KEY` | Clave privada del relayer (formato `ed25519:...`) |

## Opcional (Intents solver relay)

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_NEAR_INTENTS_SOLVER_RELAY_API_KEY` | API key del solver relay (Partners Portal). Si no la usas, puedes omitirla. |

## Otras que ya uses en local

Asegúrate de tener también en Amplify las que ya usas en `.env`, por ejemplo:

- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEAR_AI_API_KEY`
- `LLAMA_CLOUD_API_KEY`
- `SPECIALIST_VERIFICATION_API_URL`
- `CLOUDINARY_URL`
- `ESCROW_ACCOUNT_ID`, `ESCROW_PRIVATE_KEY`
- `CRON_SECRET` (si usas cron en producción)

**Importante:** Los valores (sobre todo las claves privadas) no se deben subir al repo. Configúralos solo en la consola de Amplify. Después de guardar, haz **Redeploy** del branch para que el build use las nuevas variables.
