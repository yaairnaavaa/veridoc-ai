# Veridoc

Aplicación web para análisis de historias clínicas y resultados de laboratorio con IA, pagos en USDT (NEAR) y marketplace de segunda opinión médica. Los usuarios inician sesión con email o redes sociales (Privy), tienen una wallet NEAR en segundo plano y pueden recibir USDT, pagar a especialistas vía escrow y retirar a otras redes.

---

## Características principales

- **Análisis con IA** — Análisis privado de análisis de sangre y documentos médicos (NEAR AI, LlamaParse para PDFs).
- **Login sin seed phrases** — Email, redes sociales o passkey con [Privy](https://docs.privy.io/); se crea automáticamente una wallet NEAR.
- **Pagos en USDT** — Saldo USDT en NEAR, depósitos desde varias cadenas (NEAR Intents) y retiros gasless (meta-transacciones NEP-366).
- **Segunda opinión** — Pagos en escrow; al entregar el especialista, se libera automáticamente (85% especialista, 15% plataforma).
- **Marketplace de especialistas** — Perfiles verificados, onboarding y pagos integrados.

---

## Stack técnico

- **Frontend / Backend:** [Next.js 16](https://nextjs.org/) (App Router, Server Actions, API routes)
- **Auth y wallet:** [Privy](https://docs.privy.io/) + NEAR (cuenta implícita por usuario)
- **Blockchain:** [NEAR Protocol](https://near.org/) — RPC, USDT (NEP-141), NEP-366 (relayer), [NEAR Intents](https://docs.near-intents.org/) para depósitos/retiros multichain
- **IA:** [NEAR AI](https://near.ai) (análisis médico), [LlamaParse](https://cloud.llamaindex.ai) (extracción de PDFs)
- **Medios:** [Cloudinary](https://cloudinary.com/) (fotos y documentos de especialistas)
- **i18n:** next-intl (es/en)

Resumen detallado de tecnologías y APIs: [docs/TECHNOLOGIES_AND_APIS.md](docs/TECHNOLOGIES_AND_APIS.md).

---

## Requisitos

- **Node.js** 20+
- **npm** (o yarn/pnpm/bun)
- Cuentas y API keys (ver abajo): Privy, LlamaParse, NEAR AI; opcionales: Cloudinary, relayer NEAR, escrow, API de especialistas

---

## Instalación y desarrollo

```bash
# Clonar e instalar dependencias
git clone <repo-url>
cd veridoc-ai
npm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus API keys (ver sección Variables de entorno)

# Arrancar en desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Para HTTPS local (p. ej. Privy): ver [docs/CADDY_SETUP.md](docs/CADDY_SETUP.md).

---

## Variables de entorno

Copia `.env.example` a `.env` y rellena los valores. En producción (Vercel, Amplify, etc.) configura las mismas variables en el panel del hosting; el `.env` no se sube a Git.

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | App ID de Privy (login y wallets) | Sí |
| `LLAMA_CLOUD_API_KEY` | API key LlamaParse (PDFs) | Sí |
| `NEAR_AI_API_KEY` | API key NEAR AI (análisis médico) | Sí |
| `SPECIALIST_VERIFICATION_API_URL` | URL del API de verificación de especialistas | No (marketplace usa datos internos si no está) |
| `CLOUDINARY_URL` | Cloudinary (fotos/documentos especialistas) | No |
| `NEXT_PUBLIC_NEAR_NETWORK` | `mainnet` o `testnet` | No (default: mainnet) |
| `NEAR_FAUCET_ACCOUNT_ID` / `NEAR_FAUCET_PRIVATE_KEY` | Cuenta que financia cuentas nuevas (activación automática) | No (recomendado para UX) |
| `NEAR_RELAYER_ACCOUNT_ID` / `NEAR_RELAYER_PRIVATE_KEY` | Relayer para retiros USDT (paga gas) | No (necesario para retiros) |
| `ESCROW_ACCOUNT_ID` / `ESCROW_PRIVATE_KEY` | Escrow para pagos de segunda opinión | No (necesario para pagos a especialistas) |
| `PLATFORM_FEE_ACCOUNT_ID` | Cuenta que recibe el 15% de fee | No (default: veridoc.near) |
| `CRON_SECRET` | Secret para `/api/cron/release-escrow` | No (necesario si usas cron externo) |
| `NEXT_PUBLIC_NEAR_INTENTS_SOLVER_RELAY_API_KEY` | API key solver relay (retiros POA a otras redes) | No |

Detalle y ejemplos: [.env.example](.env.example). Producción en Amplify: [docs/AMPLIFY_ENV.md](docs/AMPLIFY_ENV.md).

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción (tras `build`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir archivos |

---

## Estructura del proyecto (resumen)

```
app/
  [locale]/           # Rutas con i18n (es/en)
    page.tsx           # Inicio
    analisis/          # Análisis de documentos / sangre
    profile/           # Perfil usuario, pagos y saldo, retiros
    marketplace/       # Listado y detalle de especialistas, segunda opinión
    status/            # Estado de servicios (/status)
    veridoc/           # Flujo Veridoc (subida, análisis, resultados)
  api/                 # API routes
    near/              # relay-withdraw, relay-escrow-deposit, fund
    cron/              # release-escrow (liberación de pagos)
    consultations/     # confirm-payment, etc.
    status/            # GET estado de todos los servicios
context/               # NearContext, Privy
lib/                   # near-config, near-usdt, near-intents-withdraw, escrow, cloudinary
docs/                  # Documentación (AMPLIFY_ENV, ESCROW, TECHNOLOGIES_AND_APIS, etc.)
```

---

## Estado de servicios

La ruta **`/status`** (o `/[locale]/status`) consulta el API `/api/status` y muestra el estado de todos los servicios configurados:

- Privy, NEAR RPC, NEAR funding, NEAR relay  
- LlamaParse, NEAR AI, Cloudinary  
- NEAR Intents Solver, API verificación especialistas  
- Escrow (config + on-chain), Cron release escrow  

Útil para comprobar que las variables de entorno y los servicios externos están correctos en local o en producción.

---

## Documentación adicional

| Documento | Contenido |
|-----------|------------|
| [docs/TECHNOLOGIES_AND_APIS.md](docs/TECHNOLOGIES_AND_APIS.md) | Tecnologías y APIs (NEAR, Privy, USDT, escrow, IA, etc.) |
| [docs/AMPLIFY_ENV.md](docs/AMPLIFY_ENV.md) | Variables de entorno en AWS Amplify |
| [docs/ESCROW_SEGUNDA_OPINION_NEAR.md](docs/ESCROW_SEGUNDA_OPINION_NEAR.md) | Flujo de escrow y pagos a especialistas |
| [docs/ESCROW_IMPLEMENTATION_SUMMARY.md](docs/ESCROW_IMPLEMENTATION_SUMMARY.md) | Resumen de implementación del escrow |
| [docs/CADDY_SETUP.md](docs/CADDY_SETUP.md) | HTTPS local con Caddy |
| [docs/NEAR_INTENTS_PAGOS_ESPECIALISTAS.md](docs/NEAR_INTENTS_PAGOS_ESPECIALISTAS.md) | NEAR Intents y pagos |

---

## Despliegue

- **Vercel:** Conectar el repo y configurar las variables de entorno en el dashboard. Build: `npm run build`, output: Next.js.
- **AWS Amplify:** Ver [docs/AMPLIFY_ENV.md](docs/AMPLIFY_ENV.md) para configurar variables y que estén disponibles en runtime (incl. `.env.production` en el build si aplica).

Tras desplegar, revisa `/status` para confirmar que los servicios requeridos aparecen como operativos.

---

## Licencia

Proyecto privado. Consultar con los mantenedores para uso o distribución.
