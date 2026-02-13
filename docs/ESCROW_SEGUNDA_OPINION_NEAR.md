# Diseño: Escrow y distribución de pagos para segunda opinión (NEAR + USDT)

**Documento · Veridoc AI**  
**Objetivo:** Recibir el pago de cada segunda opinión en custodia (USDT en NEAR), retener un fee del 15% y liberar el 85% al especialista **24 horas después** de confirmada la entrega.

---

## 1. Resumen del modelo

| Concepto | Valor |
|----------|--------|
| **Activo** | USDT (NEP-141) en NEAR |
| **Custodia** | Cuenta escrow en NEAR (treasury) que recibe el pago del paciente |
| **Fee plataforma** | 15% por cada segunda opinión |
| **Pago al especialista** | 85% del monto, liberado **24 h** después de confirmar entrega |
| **Confirmación de entrega** | Cuando el especialista marca la consulta como "attended" y envía el dictamen |

---

## 2. Flujo de dinero (alto nivel)

```
┌─────────────────┐     Pagar X USDT      ┌──────────────────┐    24h después     ┌─────────────────┐
│  Paciente       │ ───────────────────►  │  Cuenta Escrow   │  de "entregado"   │  Especialista   │
│  (wallet NEAR)  │   (ft_transfer)         │  (treasury)      │ ───────────────►  │  (85% de X)     │
└─────────────────┘                        │  USDT retenido   │   release()       └─────────────────┘
                                           └────────┬─────────┘
                                                    │ 15% fee
                                                    ▼
                                           ┌──────────────────┐
                                           │  Cuenta Plataforma│
                                           │  (fee acumulado)  │
                                           └──────────────────┘
```

---

## 3. Estados de una consulta (con pago)

```
  [pendiente]
       │
       │  Paciente paga X USDT → escrow (tx on-chain)
       ▼
  [paid]  ← "pagada en custodia"
       │
       │  Especialista entrega dictamen (status = "attended")
       ▼
  [delivered]  ← se registra delivered_at
       │
       │  Pasan 24 horas
       ▼
  [release_scheduled]  ← job/cron encuentra: delivered_at + 24h <= now
       │
       │  Backend ejecuta: 85% → especialista, 15% → plataforma
       ▼
  [released]
```

---

## 4. Modelo de datos (backend / API de consultas)

El backend de especialistas (Tatchi/API de consultas) debe ampliarse con campos de pago y tiempos. Si no controlas el esquema, estos campos pueden vivir en una tabla propia `consultation_payments` en tu app y sincronizarse por `consultation_id`.

### 4.1 Campos a añadir (por consulta o en `consultation_payments`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `amount_raw` | string | Monto USDT en crudo (6 decimales, ej. "10000000" = 10 USDT) |
| `escrow_account_id` | string | Cuenta NEAR que recibió el pago (escrow/treasury) |
| `escrow_tx_hash` | string | Hash de la transacción de depósito en escrow (opcional, para auditoría) |
| `paid_at` | ISO datetime | Cuando se registró el pago en custodia |
| `delivered_at` | ISO datetime | Cuando la consulta pasó a `status: "attended"` (entrega confirmada) |
| `release_after_at` | ISO datetime | `delivered_at + 24 horas`; no liberar antes de esta fecha |
| `released_at` | ISO datetime | Cuando se ejecutó la distribución (null si aún no) |
| `specialist_amount_raw` | string | 85% del monto, en crudo |
| `platform_fee_raw` | string | 15% del monto, en crudo |
| `release_tx_hash` | string | Hash de la tx de liberación (o primera tx si son dos) |

### 4.2 Cálculo de montos (USDT 6 decimales)

- `amount_raw` = lo que el paciente pagó (ej. 10 USDT → `"10000000"`).
- `platform_fee_raw` = `floor(amount_raw * 15 / 100)`.
- `specialist_amount_raw` = `amount_raw - platform_fee_raw`.

Ejemplo: 10 USDT → 1.5 USDT fee, 8.5 USDT especialista (en crudo: 1500000 y 8500000).

---

## 5. Arquitectura elegida: Opción B (Cuenta escrow + backend)

**Decisión:** Cuenta escrow (treasury) en NEAR + backend que ejecuta la liberación. Sin smart contract.

- **Cuenta NEAR “escrow”:** Una cuenta (ej. `escrow.veridoc.near`) que recibe el USDT del paciente.
- **Backend:** Registra qué consultas están pagadas y cuándo se entregó. Pasadas 24 h desde `delivered_at`, el backend (con clave de la cuenta escrow) ejecuta **dos** transferencias USDT desde escrow:
  1. 85% → cuenta NEAR del especialista.
  2. 15% → cuenta NEAR de la plataforma (fee).
- **Ventajas:** Reutiliza el patrón actual (relay, `createTransferUsdtAction`), sin desarrollar contrato; compatible con meta-transacciones para experiencia Web2.
- **Seguridad:** La clave de escrow solo en servidor (Amplify env / AWS Secrets Manager); nunca en frontend.

### 5.1 Meta-transacciones (experiencia Web2)

Para que el paciente no tenga que pagar gas ni manejar NEAR en su wallet, el **depósito en escrow** se hace con el mismo patrón que el retiro actual:

1. **Usuario firma una sola vez:** En el frontend, el paciente firma un **SignedDelegate** (NEP-366) que autoriza una llamada `ft_transfer(X USDT, escrow_account_id, memo)` en su nombre. La firma se hace con su wallet (Privy/embedded o externa); no se envía ninguna transacción desde el navegador.
2. **Relayer envía y paga gas:** El frontend envía el `signedDelegateBase64` a un endpoint tipo `POST /api/near/relay-escrow-deposit`. El relayer (misma cuenta que para retiros o una dedicada) verifica que el destino del `ft_transfer` es **solo la cuenta escrow** (whitelist), luego envía la transacción a la red y paga el gas.
3. **Resultado:** El paciente solo ve “Pagar X USDT y solicitar” → una aprobación en wallet (o un solo paso si usa embedded wallet) → “Listo”. Sin NEAR para gas, sin pasos extra; experiencia tipo Web2.

**Implementación:**

- Nuevo endpoint `POST /api/near/relay-escrow-deposit`: body `{ signedDelegateBase64 }`. Misma lógica que `relay-withdraw` pero:
  - Comprobar que `getFtTransferReceiverId(delegate)` === `ESCROW_ACCOUNT_ID` (solo permitir depósitos al escrow).
  - Opcional: extraer `memo` del `ft_transfer` para asociar a `consultation_id` si se envía en el memo.
- En **RequestSecondOpinion**: en lugar de que el usuario envíe una transacción directa, construir el delegate con `ft_transfer(amountRaw, ESCROW_ACCOUNT_ID, memo: consultationId)` y llamar a `relay-escrow-deposit`; con la respuesta `txHash` llamar a `confirm-payment`.

La **liberación** (85% + 15%) la hace el backend con la clave de la cuenta escrow; no interviene el usuario ni meta-tx (es automática 24 h después de la entrega).

---

## 6. Flujo detallado por pasos

### 6.1 Paciente solicita segunda opinión y paga

1. En **RequestSecondOpinion**: antes de llamar a `createConsultationAction`, comprobar saldo USDT del paciente (`getUsdtBalance(walletId)`).
2. Si el backend permite crear consulta “sin pagar” y luego marcar como pagada, flujo recomendado:
   - (Opcional) Crear la consulta en estado "pending" con `amount_usdt` y `specialist_account` (para tener `consultation_id`).
   - Usuario firma **ft_transfer** de `priceUsdt` USDT desde su cuenta NEAR hacia la **cuenta escrow** (no al especialista). En el **memo** del `ft_transfer` incluir `consultation_id` o un token único que el backend asocie a la consulta (ej. `consultation_id` si ya existe).
   - Frontend llama a un endpoint propio, ej. `POST /api/consultations/confirm-payment` con `{ consultationId, txHash, amountRaw }` (o el backend escucha por webhook/explorer si tienes indexer). El backend registra en la consulta: `paid_at`, `amount_raw`, `escrow_tx_hash`, estado "paid".
   - Si la consulta se crea **después** del pago: el frontend primero hace el pago a escrow con memo `request_id` temporal; luego crea la consulta enviando ese `request_id` o `tx_hash` para que el backend vincule y ponga "paid".

3. **Crear consulta** (createConsultationAction) con los datos actuales; si el backend ya tiene el concepto de “pago en escrow”, incluir en el body algo como `paymentTxHash` y `amountRaw` para que marque la consulta como pagada y notifique al especialista.

### 6.2 Especialista entrega la segunda opinión

- Flujo actual: el especialista usa **ConsultationResponseModal** y llama a `updateConsultationAction(consultationId, { status: "attended", analysisCommentsSpecialist })`.
- **Backend:** Al pasar la consulta a `status: "attended"`, debe guardar **delivered_at = now** y calcular **release_after_at = delivered_at + 24 horas**. Si el backend no lo hace, un webhook o un job que escuche cambios de estado puede escribir estos campos.

### 6.3 Liberación del pago (24 h después)

- **Job / cron** (cada 5–15 min): Seleccionar consultas donde:
  - `delivered_at` está definido,
  - `released_at` es null,
  - `release_after_at <= now`.
- Para cada una:
  1. Calcular `specialist_amount_raw` y `platform_fee_raw` (85% / 15%).
  2. Desde la **cuenta escrow** (o el relayer que firma por ella), ejecutar:
     - `ft_transfer(specialist_amount_raw)` a la cuenta NEAR del especialista.
     - `ft_transfer(platform_fee_raw)` a la cuenta NEAR de la plataforma.
  3. Registrar `released_at`, `release_tx_hash` (o hashes de las dos transacciones).
- Asegurar que el especialista tenga **storage_deposit** en USDT (NEP-145); si no, el relayer puede hacer `storage_deposit` antes del primer `ft_transfer` (como en `relay-withdraw`).

---

## 7. Configuración y constantes

| Variable | Uso |
|----------|-----|
| `ESCROW_ACCOUNT_ID` | Cuenta NEAR que recibe los pagos (escrow). Ej. `escrow.veridoc.near`. |
| `ESCROW_PRIVATE_KEY` | Clave para que el backend firme las liberaciones (solo en servidor, nunca en frontend). |
| `PLATFORM_FEE_ACCOUNT_ID` | Cuenta que recibe el 15%. Ej. `veridoc.near` o `treasury.veridoc.near`. |
| `PLATFORM_FEE_BASIS_POINTS` | 1500 = 15%. Por si en el futuro quieres parametrizar. |
| `RELEASE_DELAY_HOURS` | 24. |

---

## 8. Plan de implementación (pasos ordenados)

| # | Paso | Descripción | Dependencias |
|---|------|-------------|--------------|
| **1** | **Cuenta escrow y fee** | Crear (o designar) cuenta NEAR para escrow y cuenta para fee. Configurar `ESCROW_ACCOUNT_ID`, `ESCROW_PRIVATE_KEY`, `PLATFORM_FEE_ACCOUNT_ID` en backend/.env. Asegurar que la cuenta escrow tenga NEAR para gas y esté registrada en USDT (NEP-145). | — |
| **2** | **Modelo de datos de pago** | En el backend de consultas (o en tu app): añadir campos `amount_raw`, `escrow_tx_hash`, `paid_at`, `delivered_at`, `release_after_at`, `released_at`, `specialist_amount_raw`, `platform_fee_raw`, `release_tx_hash`. O crear tabla `consultation_payments` vinculada por `consultation_id`. | — |
| **3** | **API confirmación de pago** | Endpoint `POST /api/consultations/confirm-payment` (o en tu backend): recibe `consultationId`, `txHash`, `amountRaw`; verifica (RPC o indexer) que la tx envió ese monto a la cuenta escrow; actualiza la consulta como "paid" y guarda `paid_at`, `amount_raw`, `escrow_tx_hash`. | 1, 2 |
| **4a** | **API relay-escrow-deposit (meta-tx)** | Endpoint `POST /api/near/relay-escrow-deposit`: recibe `signedDelegateBase64`; verifica que el destino del `ft_transfer` sea `ESCROW_ACCOUNT_ID`; relayer envía la tx y paga gas. Devuelve `txHash`. Reutiliza la misma lógica que `relay-withdraw` con whitelist de receptor = escrow. | 1 |
| **4b** | **Flujo de pago en RequestSecondOpinion (meta-tx)** | 1) Comprobar saldo USDT. 2) Crear consulta "pending" si hace falta para tener `consultation_id`. 3) Usuario firma **SignedDelegate** `ft_transfer(amountRaw, ESCROW_ACCOUNT_ID, memo: consultationId)`; frontend llama a `relay-escrow-deposit` (gas lo paga relayer → experiencia Web2). 4) Con `txHash`, llamar a confirm-payment. Si la consulta se crea después del pago: pagar con memo temporal → crear consulta pasando `txHash`/memo. | 3, 4a, getUsdtBalance, createTransferUsdtAction |
| **5** | **Registrar delivered_at** | En el backend: al hacer PATCH de consulta con `status: "attended"`, guardar `delivered_at = now` y `release_after_at = now + 24h`. Si no controlas el backend, un job que sincronice consultas "attended" puede rellenar estos campos. | 2 |
| **6** | **Job de liberación** | Cron o queue job: cada X min, buscar consultas con `delivered_at` set, `released_at` null y `release_after_at <= now`. Para cada una: calcular 85% / 15%, ejecutar desde escrow dos `ft_transfer` (especialista + plataforma), guardar `released_at` y `release_tx_hash`. Usar relayer o clave de escrow en backend; asegurar storage en USDT para el especialista si hace falta. | 1, 2, 5 |
| **7** | **UI y notificaciones** | Mostrar en la app estado de pago (pagado / entregado / liberado) y, si aplica, "Pago al especialista programado para &lt;fecha&gt;". Opcional: email/in-app al especialista cuando el pago fue liberado. | 2, 6 |

---

## 9. Diagrama de secuencia (esencial)

```
Paciente          Frontend           Backend              Escrow (NEAR)      Especialista
   |                  |                   |                        |                  |
   |  Elige análisis  |                   |                        |                  |
   |  "Pagar X USDT"  |                   |                        |                  |
   |----------------->|                   |                        |                  |
   |                  | GET balance       |                        |                  |
   |                  |------------------>|                        |                  |
   |                  | (opcional)        |                        |                  |
   |                  |                   |                        |                  |
   |  Firma ft_transfer (X USDT → escrow) |                        |                  |
   |----------------------------------------->|  ft_transfer X      |                  |
   |                  |                   |                        |                  |
   |                  | POST confirm-payment(txHash, amount, consultationId)         |
   |                  |------------------>|                        |                  |
   |                  |                   | Guarda paid_at, amount |                  |
   |                  |                   | Notifica               |----------------->|
   |                  |                   |                        |                  |
   |                  |                   |     ... especialista trabaja ...          |
   |                  |                   |                        |                  |
   |                  |                   | PATCH status=attended  |                  |
   |                  |                   |<-----------------------------------------|
   |                  |                   | delivered_at, release_after_at = +24h    |
   |                  |                   |                        |                  |
   |                  |                   | [Cron] release_after_at <= now           |
   |                  |                   | ft_transfer 85% ------------------------>|
   |                  |                   | ft_transfer 15% → platform                |
   |                  |                   | released_at = now      |                  |
```

---

## 10. Consideraciones de seguridad

- **Clave escrow:** Solo en backend, en vault o secrets manager; nunca en frontend ni en repositorio.
- **Verificación de pago:** En `confirm-payment`, validar en chain (RPC `tx_status` o view del contrato) que la transacción existe, va a la cuenta escrow y el monto coincide.
- **Idempotencia:** El job de liberación debe comprobar `released_at == null` antes de enviar las transferencias y actualizar `released_at` en la misma transacción lógica para no pagar dos veces.
- **Límites:** Opcional: límite máximo por consulta o por día para el cron, para evitar gastar todo el gas en un fallo.

---

## 11. Resumen ejecutivo

- **Escrow:** Cuenta NEAR (o contrato) que recibe el USDT del paciente al solicitar la segunda opinión.
- **Fee:** 15% a cuenta plataforma, 85% al especialista.
- **Liberación:** 24 horas después de que el especialista marque la consulta como atendida; un job ejecuta las dos transferencias desde escrow.
- **Implementación mínima:** Cuenta escrow + backend (pasos 1–6); opcionalmente contrato escrow más adelante para mayor descentralización.

---

## 12. Despliegue en AWS Amplify

**Sí, todo este flujo puede correr en AWS Amplify.** Desglose:

### 12.1 Qué corre en Amplify

| Componente | Dónde corre | Notas |
|------------|-------------|--------|
| **Next.js (SSR + API routes)** | Amplify (serverless) | Ya lo usas. Las API routes son serverless functions. |
| **Relay depósito escrow** | `POST /api/near/relay-escrow-deposit` | Misma cuenta/relayer que `relay-withdraw`; solo añadir endpoint y whitelist escrow. |
| **Confirmación de pago** | `POST /api/consultations/confirm-payment` | Puede ser API route en Next que llame al backend de consultas o que escriba en DB propia. |
| **Liberación (85% + 15%)** | Lógica en backend; **quién la ejecuta** puede ser una API route llamada por un cron externo (ver abajo). | La cuenta escrow firma desde el servidor (env var en Amplify). |

No necesitas EC2 ni ECS: las API routes de Next.js en Amplify ejecutan la lógica de relay y de liberación.

### 12.2 Variables de entorno en Amplify

Añadir en **Environment variables** de la app (y al `amplify.yml` en el `grep` para que se escriban en `.env.production` en build, igual que el resto):

- `ESCROW_ACCOUNT_ID` — Cuenta NEAR que recibe los pagos (ej. `escrow.veridoc.near`).
- `ESCROW_PRIVATE_KEY` — Clave de la cuenta escrow (solo para liberación; **nunca** en frontend).
- `PLATFORM_FEE_ACCOUNT_ID` — Cuenta que recibe el 15% (ej. `veridoc.near`).
- Opcional: `NEXT_PUBLIC_ESCROW_ACCOUNT_ID` — Si el frontend debe mostrar la dirección de depósito (o se puede derivar de env sin `NEXT_PUBLIC_` vía API).

En `amplify.yml`, en la línea del `grep`, añadir estas claves para que estén disponibles en runtime (ver `docs/AMPLIFY_ENV.md`).

### 12.3 Cron / job de liberación (24 h)

Amplify **no incluye un cron integrado** para ejecutar código cada X minutos. Opciones:

| Opción | Cómo | Pros / contras |
|--------|------|-----------------|
| **A. Cron externo** | Servicio tipo [cron-job.org](https://cron-job.org), [EasyCron](https://www.easycron.com) o un Lambda + EventBridge (ver B) que cada 10–15 min haga `GET` o `POST` a una ruta protegida, ej. `POST /api/cron/release-escrow` con header `Authorization: Bearer <secret>` o `x-cron-secret: <secret>`. Esa ruta ejecuta la lógica de “consultas con release_after_at <= now” y hace las dos `ft_transfer` desde escrow. | Muy simple; todo el código sigue en Next.js. El secret debe estar en env y en el servicio externo. |
| **B. EventBridge + Lambda** | Regla EventBridge (schedule) que invoca una Lambda cada 10 min. La Lambda hace `fetch(https://tu-app.amplifyapp.com/api/cron/release-escrow`, { headers: { "x-cron-secret": process.env.CRON_SECRET } }). La API route hace la liberación. | Todo en AWS; no dependes de un servicio externo. Requiere crear la Lambda y la regla. |
| **C. Amplify + Lambda (Gen 2)** | Si usas Amplify Gen 2 con funciones programáticas, se puede definir una función que se dispare por schedule; esa función puede llamar a la misma URL de la API route. | Integrado en Amplify si ya usas Gen 2. |

**Recomendación para empezar:** Opción A (cron externo llamando a ` /api/cron/release-escrow`) con un `CRON_SECRET` en Amplify; la API route comprueba el header y ejecuta el job. Si más adelante quieres todo en AWS, migrar a B.

### 12.4 Resumen Amplify

- **Sí se puede correr en Amplify:** Next.js, API routes (relay escrow, confirm-payment, release-escrow), env vars para escrow y relayer.
- **Meta-transacciones:** El paciente solo firma; el relayer paga gas (relay-escrow-deposit), experiencia Web2.
- **Cron:** No está dentro del hosting de Amplify; usar cron externo que llame a una API route protegida o EventBridge + Lambda que haga esa llamada.
