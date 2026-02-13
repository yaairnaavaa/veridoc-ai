# Resumen de Implementación: Escrow y Pagos de Segunda Opinión

**Fecha:** Implementación completa del flujo de escrow con meta-transacciones y liberación automática.

---

## ✅ Lo que está implementado (Frontend + API Routes)

### 1. **Helper Functions** (`lib/escrow.ts`)
- `calculatePlatformFee()` - Calcula 15% del monto
- `calculateSpecialistAmount()` - Calcula 85% del monto
- `splitEscrowAmount()` - Divide el monto en fee y pago al especialista

### 2. **Configuración** (`lib/near-config.ts`)
- `ESCROW_ACCOUNT_ID` - Cuenta que recibe los pagos (default: `escrow.veridoc.near`)
- `PLATFORM_FEE_ACCOUNT_ID` - Cuenta que recibe el 15% (default: `veridoc.near`)

### 3. **Meta-transacción de depósito** (`app/api/near/relay-escrow-deposit/route.ts`)
- Endpoint: `POST /api/near/relay-escrow-deposit`
- Recibe `signedDelegateBase64` del frontend
- **Whitelist:** Solo permite transferencias a `ESCROW_ACCOUNT_ID`
- Relayer paga el gas (experiencia Web2)
- Verifica storage deposit (NEP-145) para escrow si es necesario
- Retorna `txHash` y `memo` (consultation_id si está en el memo)

### 4. **Confirmación de pago** (`app/api/consultations/confirm-payment/route.ts`)
- Endpoint: `POST /api/consultations/confirm-payment`
- Recibe: `consultationId`, `txHash`, `amountRaw`
- Llama al backend para registrar el pago como "paid"

### 5. **Job de liberación** (`app/api/cron/release-escrow/route.ts`)
- Endpoint: `POST /api/cron/release-escrow`
- **Protegido por:** Header `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>`
- Busca consultas listas para liberar (delivered_at + 24h <= now, released_at == null)
- Ejecuta dos transferencias desde escrow:
  - 85% → cuenta NEAR del especialista
  - 15% → cuenta plataforma
- Actualiza backend con `released_at` y `release_tx_hash`

### 6. **Flujo completo en UI** (`app/[locale]/marketplace/RequestSecondOpinion.tsx`)
- Verifica saldo USDT antes de proceder
- Crea consulta primero (para tener `consultationId`)
- Firma `SignedDelegate` para `ft_transfer` a escrow (con memo = consultationId)
- Llama a `relay-escrow-deposit` (meta-transacción, gasless)
- Llama a `confirm-payment` para registrar en backend
- Muestra estado de éxito con mensaje claro

### 7. **Funciones de consultas actualizadas** (`app/actions/consultations.ts`)
- `confirmPaymentAction()` - Nueva función para confirmar pago

### 8. **USDT utilities actualizadas** (`lib/near-usdt.ts`)
- `createTransferUsdtAction()` ahora acepta `memo` opcional

---

## ⚠️ Lo que falta implementar en el Backend (Tatchi/API de Consultas)

El backend debe implementar estos endpoints y campos en la base de datos:

### Campos a añadir al modelo de Consulta:

```typescript
{
  // ... campos existentes ...
  amount_raw?: string;              // Monto USDT en crudo (6 decimales)
  escrow_account_id?: string;       // Cuenta escrow (default: ESCROW_ACCOUNT_ID)
  escrow_tx_hash?: string;          // Hash de la tx de depósito
  paid_at?: Date;                   // Cuando se registró el pago
  delivered_at?: Date;              // Cuando status = "attended"
  release_after_at?: Date;          // delivered_at + 24 horas
  released_at?: Date;               // Cuando se liberó el pago
  specialist_amount_raw?: string;   // 85% del monto
  platform_fee_raw?: string;        // 15% del monto
  release_tx_hash?: string;         // Hash de la tx de liberación
  specialist_tx_hash?: string;      // Hash de la tx al especialista
  platform_tx_hash?: string;       // Hash de la tx a plataforma
}
```

### Endpoints a implementar:

#### 1. `POST /api/consultations/:id/confirm-payment`
```json
Body: {
  "txHash": "string",
  "amountRaw": "string",
  "paidAt": "ISO datetime"
}
```
**Acción:** Marca la consulta como pagada, guarda `paid_at`, `amount_raw`, `escrow_tx_hash`, estado "paid".

#### 2. `PATCH /api/consultations/:id` (actualizar)
Cuando `status` cambia a `"attended"`:
- Guardar `delivered_at = now`
- Calcular `release_after_at = delivered_at + 24 horas`
- Calcular `specialist_amount_raw` y `platform_fee_raw` (85%/15%)

#### 3. `GET /api/consultations/pending-release`
**Query:** Consultas donde:
- `delivered_at` está definido
- `released_at` es null
- `release_after_at <= now`

**Retorna:** Array de consultas con `_id`, `amount_raw`, `specialistAccount`, `specialist_amount_raw`, `platform_fee_raw`.

#### 4. `POST /api/consultations/:id/release`
```json
Body: {
  "releasedAt": "ISO datetime",
  "releaseTxHash": "string",
  "specialistTxHash": "string",
  "platformTxHash": "string"
}
```
**Acción:** Marca como liberado, guarda `released_at` y los hashes de las transacciones.

---

## 🔧 Configuración requerida

### Configuración de la wallet de escrow

Sí, hace falta **crear y configurar una cuenta NEAR dedicada** que actúe como escrow. No es “configurar un wallet” en el sentido de MetaMask/Privy: es una cuenta NEAR que solo usa el backend para recibir USDT y luego liberar (85% + 15%).

#### 1. Crear la cuenta escrow en NEAR

Tienes dos opciones:

- **Opción A – Subcuenta de tu cuenta principal**  
  Si ya tienes `veridoc.near`, crea una subcuenta desde [NEAR Wallet](https://wallet.near.org) (o con `near-cli`):
  - Nombre sugerido: `escrow.veridoc.near`
  - Al crearla, NEAR Wallet te dará una **clave de acceso** (seed phrase o clave ed25519). Esa clave es la que usarás como `ESCROW_PRIVATE_KEY`.

- **Opción B – Cuenta nueva**  
  Crear una cuenta nueva en [wallet.near.org](https://wallet.near.org) (por ejemplo `escrow-veridoc.near`), guardar la clave y usar ese account id como escrow.

No hace falta “conectar” esta cuenta en la app ni en el frontend. Solo existe en NEAR y el backend la usa con la clave privada.

#### 2. Fondear la cuenta con NEAR (para gas)

La cuenta escrow **tiene que tener NEAR** para pagar el gas cuando el cron ejecute las liberaciones (dos `ft_transfer` por consulta: uno al especialista, otro a la plataforma).

- En **testnet**: envía ~1–2 NEAR desde wallet.testnet.near.org a `escrow.veridoc.near` (o la cuenta que uses).
- En **mainnet**: envía al menos 1–5 NEAR (según volumen; cada liberación consume poco gas pero hay que tener margen).

Puedes usar la misma cuenta que ya usas como relayer (por ejemplo `veridoc.near`) para enviar NEAR a la cuenta escrow.

#### 3. Registro en el contrato USDT (NEP-145)

Para **recibir y enviar USDT**, la cuenta escrow debe tener “storage” en el contrato USDT.

- **No hace falta que lo hagas tú a mano.** En el código, cuando un paciente hace el primer depósito a escrow, el **relayer** (en `relay-escrow-deposit`) comprueba si la cuenta escrow tiene storage en USDT y, si no, hace `storage_deposit` por ti (paga el relayer, no la cuenta escrow).
- Si quieres hacerlo tú una vez (opcional): desde NEAR Wallet o `near-cli`, llama al contrato `usdt.tether-token.near`, método `storage_deposit`, con `account_id` = tu cuenta escrow. Quien envía la transacción paga ~0.00125 NEAR.

#### 4. Obtener la clave privada para el servidor

Para que el **cron de liberación** pueda firmar en nombre del escrow, el servidor necesita la clave privada en formato `ed25519:...`:

- Si creaste la cuenta con NEAR Wallet (seed phrase), puedes exportar la clave en [wallet.near.org](https://wallet.near.org) → tu cuenta escrow → Settings → Export private key (o usar `near-cli` con la seed).
- El valor debe ser una cadena que empiece por `ed25519:` seguida de la clave en base58.

Esa cadena es **ESCROW_PRIVATE_KEY**. Solo debe estar en el servidor (`.env` o Amplify / Secrets Manager), nunca en el frontend ni en el repo.

#### 5. Resumen de pasos

| Paso | Acción |
|------|--------|
| 1 | Crear cuenta NEAR para escrow (ej. `escrow.veridoc.near`) y guardar la clave. |
| 2 | Enviar 1–5 NEAR a esa cuenta (para gas de las liberaciones). |
| 3 | (Opcional) Hacer `storage_deposit` en USDT para esa cuenta; si no, el relayer lo hace en el primer depósito. |
| 4 | En el servidor, configurar `ESCROW_ACCOUNT_ID` y `ESCROW_PRIVATE_KEY`. |

No hay que “configurar” ningún wallet en el frontend para el escrow: la wallet de escrow solo la usa el backend con esa clave.

---

### Variables de entorno (`.env` y Amplify):

```bash
# Escrow account (debe existir en NEAR y tener NEAR para gas)
ESCROW_ACCOUNT_ID=escrow.veridoc.near
ESCROW_PRIVATE_KEY=ed25519:...  # Clave de la cuenta escrow (solo servidor)

# Platform fee account (puede ser tu cuenta principal, ej. veridoc.near)
PLATFORM_FEE_ACCOUNT_ID=veridoc.near

# Cron secret (para proteger /api/cron/release-escrow)
CRON_SECRET=tu-secret-random-aqui

# Relayer (ya existe; paga gas del depósito a escrow)
NEAR_RELAYER_ACCOUNT_ID=veridoc.near
NEAR_RELAYER_PRIVATE_KEY=ed25519:...
```

### Configurar cron externo:

**Opción A: cron-job.org (recomendada para empezar)**

1. Crear cuenta en [cron-job.org](https://cron-job.org)
2. Crear nuevo cron job:
   - **URL:** `https://tu-app.amplifyapp.com/api/cron/release-escrow`
   - **Método:** POST
   - **Headers:** `x-cron-secret: <CRON_SECRET>`
   - **Frecuencia:** Cada 10-15 minutos
   - **Timeout:** 60 segundos

**Opción B: AWS EventBridge + Lambda**

1. Crear Lambda que haga `POST` a `/api/cron/release-escrow` con header `x-cron-secret`
2. Crear regla EventBridge (schedule) que invoque la Lambda cada 10-15 min

---

## 📋 Flujo completo (resumen)

```
1. Usuario → RequestSecondOpinion
   ├─ Verifica saldo USDT
   ├─ Crea consulta (GET consultationId)
   └─ Firma SignedDelegate (ft_transfer a escrow, memo=consultationId)

2. Frontend → POST /api/near/relay-escrow-deposit
   ├─ Relayer verifica destino = ESCROW_ACCOUNT_ID
   ├─ Relayer envía tx y paga gas
   └─ Retorna txHash

3. Frontend → POST /api/consultations/confirm-payment
   └─ Backend marca consulta como "paid"

4. Especialista → PATCH /api/consultations/:id (status="attended")
   └─ Backend guarda delivered_at y release_after_at = delivered_at + 24h

5. Cron (cada 10-15 min) → POST /api/cron/release-escrow
   ├─ Backend retorna consultas con release_after_at <= now
   ├─ Escrow transfiere 85% → especialista
   ├─ Escrow transfiere 15% → plataforma
   └─ Backend marca como released
```

---

## 🧪 Testing

### Probar depósito en escrow:
1. Usuario con saldo USDT suficiente
2. Seleccionar análisis y especialista
3. Click "Pagar X USDT y solicitar segunda opinión"
4. Verificar que se crea consulta, se procesa pago y se confirma

### Probar liberación:
1. Marcar consulta como "attended" en backend (o vía UI)
2. Esperar 24 horas (o ajustar `release_after_at` manualmente en DB para testing)
3. Llamar manualmente a `/api/cron/release-escrow` con header `x-cron-secret`
4. Verificar que se ejecutan las dos transferencias y se actualiza `released_at`

---

## 📝 Notas importantes

- **Seguridad:** `ESCROW_PRIVATE_KEY` y `CRON_SECRET` nunca deben estar en frontend o repositorio público
- **Idempotencia:** El cron debe verificar `released_at == null` antes de transferir
- **Storage deposit:** El relayer y el escrow verifican/crean storage deposit (NEP-145) automáticamente
- **Gas:** El relayer paga gas para depósitos; el escrow paga gas para liberaciones
- **Experiencia Web2:** El usuario solo firma una vez; no necesita NEAR para gas

---

## 🚀 Próximos pasos

1. Implementar endpoints en backend (Tatchi/API de consultas)
2. Configurar variables de entorno en Amplify
3. Crear cuenta escrow en NEAR y fondearla con NEAR para gas
4. Configurar cron externo (cron-job.org o EventBridge)
5. Testing end-to-end
6. Monitoreo y alertas para fallos en liberación
