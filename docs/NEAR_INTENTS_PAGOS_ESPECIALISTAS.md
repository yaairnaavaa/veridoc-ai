# Análisis: Privy, NEAR Intents y pagos a especialistas con custodia

**Documento · Veridoc AI**  
**Referencias:** [NEAR Web Login](https://docs.near.org/web3-apps/concepts/web-login), [NEAR Intents](https://docs.near-intents.org/), [Deposits & Balances](https://docs.near-intents.org/near-intents/market-makers/verifier/deposits-and-withdrawals/deposits)

---

## 1. Estado actual de la aplicación

| Aspecto | Estado |
|--------|--------|
| **Privy** | Integración genérica (passkey, email, Google, wallet). No está configurada la variante que crea **cuenta NEAR** al login. |
| **USDT / balances** | Mock en UI (`MOCK_USDT_BALANCE`, `MOCK_BALANCES`). Sin blockchain. |
| **Pagos a especialistas** | Mockup en `RequestSecondOpinion.tsx`; no hay transacciones reales. |
| **NEAR Protocol / NEAR Intents** | No integrados. La única “NEAR” en código es NEAR AI (API de inferencia). |

Para que los usuarios tengan balances reales en NEAR Intents y los especialistas cobren ahí, hace falta:

1. Configurar **Privy para NEAR** (ej. [hello-privy](https://github.com/near-examples/hello-privy)) para que cada usuario tenga una cuenta NEAR.
2. Integrar **NEAR Intents**: depósitos de USDT (NEP-141) en el Verifier, consulta de balances (`mt_balance_of`), y ejecución de intents de pago.

Este documento añade el **paso de custodia intermedia** (escrow) para que el pago se libere al especialista solo cuando haya entregado el resultado.

---

## 2. Flujo completo: envío de análisis y pago con custodia

Cuando el usuario envía sus análisis a un especialista para segunda opinión, el pago no debe ir directo al especialista. Debe pasar por un **middleware o custodia intermedia** que retenga el USDT hasta que el especialista entregue el resultado; solo entonces se libera el pago.

### 2.1 Esquema del flujo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USUARIO (paciente)                                                         │
│  • Balance USDT en NEAR Intents (Verifier)                                  │
│  • Solicita segunda opinión y elige especialista                            │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 1: Bloqueo / reserva del pago (custodia)                              │
│  • Usuario firma intent/transferencia desde su balance en NEAR Intents      │
│  • El valor (ej. X USDT) NO va a la wallet del especialista                  │
│  • Va a una cuenta de CUSTODIA (escrow):                                    │
│    - Contrato escrow en NEAR, o                                             │
│    - Cuenta/custodio gestionado por backend/middleware                      │
│  • Se registra: request_id, specialist_id, amount, condiciones de liberación│
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 2: Envío de análisis y trabajo del especialista                       │
│  • El usuario envía análisis (datos cifrados/consentidos) al especialista   │
│  • Especialista revisa y genera “segunda opinión”                            │
│  • Especialista entrega el resultado en la plataforma (upload, API, etc.)   │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 3: Verificación y liberación del pago                                  │
│  • Middleware/backend verifica que el resultado está entregado y vinculado  │
│    al request_id (y opcionalmente que cumple criterios de calidad)         │
│  • Si OK: se ejecuta la liberación desde la custodia hacia la wallet        │
│    NEAR del especialista (transferencia o intent desde escrow → specialist) │
│  • Si no hay entrega en plazo o hay disputa: flujo de reembolso o disputa   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Dónde puede vivir la custodia (middleware / escrow)

| Opción | Descripción | Pros / contras |
|--------|-------------|-----------------|
| **A. Smart contract escrow en NEAR** | Contrato que recibe USDT, guarda `request_id` ↔ `specialist_id` ↔ `amount` y solo libera cuando se llama `release(request_id)` (p. ej. tras proof de entrega o firma del backend). | Descentralizado, lógica onchain; más desarrollo y gas. |
| **B. Cuenta NEAR controlada por backend** | Una cuenta “treasury” o “escrow” en NEAR (o en el Verifier) a la que el usuario envía el pago; el backend firma la liberación al especialista cuando confirma entrega. | Más simple de implementar; confianza en el backend. |
| **C. NEAR Intents + backend como oráculo** | El usuario crea un intent condicionado (si existe) o el flujo es: depósito → custodia → backend emite “release” (firma o llama contrato) cuando hay entrega. | Encaja con intents; requiere definir bien quién es el “executor” del release. |

En todos los casos, el **middleware** (tu backend o un contrato) debe:

- Asegurar que el pago sale del **balance del usuario en NEAR Intents** (no de otro sitio).
- Asegurar que el pago **no** llega al especialista hasta que conste la **entrega del resultado** (y, si aplica, resolución de disputas o timeout).

---

## 3. Integración en el flujo actual de “segunda opinión”

Hoy en la app, el flujo está en `RequestSecondOpinion.tsx`: el usuario elige análisis, ve el precio en USDT y pulsa “Pagar X USDT y solicitar segunda opinión”, pero es mockup.

Pasos a incorporar en el análisis (y luego en implementación):

1. **Antes de enviar la solicitud**
   - Comprobar que el usuario tiene **saldo suficiente** en NEAR Intents (consulta `mt_balance_of` al Verifier para su `account_id` y el token USDT).
   - Si no hay saldo, redirigir a depósito o onboarding de wallet NEAR/Intents.

2. **Al confirmar “Pagar y solicitar”**
   - Usuario firma la transacción/intent que **mueve X USDT desde su balance en NEAR Intents** hacia la **cuenta de custodia** (escrow o treasury), con `request_id` y `specialist_id` (y plazo, si aplica) asociados en el mensaje o en tu backend.
   - Backend/middleware registra la solicitud como “pagada en custodia” y notifica al especialista.

3. **Cuando el especialista entrega el resultado**
   - El especialista sube/marca la segunda opinión como completada en la plataforma (ya existente o por definir).
   - El middleware verifica que la entrega está vinculada al `request_id` correcto.

4. **Liberación del pago**
   - El middleware (o un contrato escrow) ejecuta la **liberación** del importe desde la custodia a la **wallet NEAR del especialista** (cuenta NEAR vinculada a su perfil).
   - Opcional: timeout para reembolso al usuario si no hay entrega; flujo de disputa si hay reclamación.

Así, en **algún momento** del envío de análisis al especialista, el usuario **sí envía desde su balance de NEAR Intents**; ese envío va primero a la **custodia intermedia**, y solo tras la entrega del resultado se libera el pago al especialista. Este es el paso que se añade explícitamente al análisis.

---

## 4. Resumen de pasos del análisis (incl. custodia)

| # | Paso | Responsable | Notas |
|---|------|-------------|--------|
| 1 | Login con Privy configurado para NEAR → cuenta NEAR por usuario | Frontend + Privy (config NEAR) | Ej. [hello-privy](https://github.com/near-examples/hello-privy). |
| 2 | Depósito de USDT en NEAR Intents (Verifier) | Usuario + frontend | NEP-141, `ft_transfer_call` al Verifier. |
| 3 | Consulta de balance en NEAR Intents para mostrar saldo real | Frontend / backend | `mt_balance_of` (account_id, token_id). |
| 4 | Al solicitar segunda opinión: envío desde balance NEAR Intents **a custodia** (escrow/middleware) | Usuario firma; custodia recibe | No directo al especialista. |
| 5 | Registro de la solicitud “pagada” y notificación al especialista | Backend / middleware | request_id, specialist_id, amount. |
| 6 | Especialista entrega resultado en la plataforma | Especialista + app | Upload o API. |
| 7 | Verificación de entrega y liberación del pago al especialista | Middleware / contrato escrow | Solo tras entrega verificada. |
| 8 | (Opcional) Timeout o disputa → reembolso al usuario | Middleware / contrato | Política de plazos y disputas. |

Este documento deja registrado que el pago al especialista pasa por un **paso intermedio de custodia** que asegura que el resultado se entrega antes de liberar el pago, y que ese movimiento parte del **balance del usuario en NEAR Intents**.

---

## 5. Pasos lógicos a ejecutar (plan de implementación)

Lista ordenada de pasos. **Tú indicas con cuál quieres avanzar** y se implementa ese (y sus dependencias mínimas si hace falta).

| # | Paso | Qué se hace | Depende de |
|---|------|-------------|------------|
| **1** | **Privy con cuenta NEAR** | Configurar Privy para que al hacer login (email/social) se cree o vincule una **wallet/cuenta NEAR** por usuario. Revisar [hello-privy](https://github.com/near-examples/hello-privy) y adaptar `PrivyProvider` + flujo de login. | — |
| **2** | **Mostrar cuenta NEAR del usuario** | En la UI (perfil, header o home): mostrar la cuenta NEAR del usuario una vez logueado con Privy-NEAR (ej. `usuario.near` o similar). Solo lectura. | 1 |
| **3** | **Depósito de USDT en NEAR Intents** | Permitir al usuario **depositar** USDT (NEP-141) en el Verifier de NEAR Intents desde su wallet NEAR. Flujo: conectar/firmar → `ft_transfer_call` al Verifier con `receiver_id` y `msg` según [Deposits](https://docs.near-intents.org/near-intents/market-makers/verifier/deposits-and-withdrawals/deposits). | 1 |
| **4** | **Consulta de balance en NEAR Intents** | Llamar al Verifier `mt_balance_of` (account_id, token_id USDT) y **sustituir el mock** de USDT en `HomeLogin` y en `app/profile/page.tsx` por el balance real. | 1, 3 (opcional: se puede mostrar 0 si no ha depositado) |
| **5** | **Definir modelo de custodia** | Decidir: contrato escrow en NEAR (A), cuenta treasury + backend (B), o NEAR Intents + backend oráculo (C). Documentar dirección/contrato y flujo release. | — |
| **6** | **Envío a custodia al solicitar segunda opinión** | En `RequestSecondOpinion`: al confirmar “Pagar X USDT y solicitar”, que el usuario **firme** la transferencia/intent desde su **balance en NEAR Intents** hacia la **cuenta de custodia** (no al especialista). Incluir en el mensaje o en backend: request_id, specialist_id, amount. | 4, 5 |
| **7** | **Backend: registrar solicitud pagada y notificar** | API/backend: al recibir confirmación onchain (o webhook) de que el pago llegó a custodia, registrar la solicitud como “pagada” y notificar al especialista (email, in-app, etc.). | 5, 6 |
| **8** | **Especialista: entregar resultado en la plataforma** | Flujo en la app para que el especialista suba o marque como “entregada” la segunda opinión vinculada a un request_id. Persistir en DB. | — (puede ir en paralelo) |
| **9** | **Liberación del pago al especialista** | Middleware/backend (o contrato): cuando conste que el resultado está entregado para ese request_id, ejecutar la **liberación** desde custodia a la **wallet NEAR del especialista**. El especialista debe tener cuenta NEAR vinculada en su perfil. | 5, 7, 8 |
| **10** | **(Opcional) Timeout y reembolso** | Si el especialista no entrega en X días, liberar de vuelta al usuario (reembolso desde custodia a la cuenta del usuario en NEAR Intents). | 5, 9 |

---

### Cómo usar esta lista

- Di por ejemplo: *“Avancemos con el paso 3”* o *“Empezamos por el paso 1”*.
- Se implementa ese paso (y si hace falta algo del paso anterior para probar, se indica).
- Cuando termines un paso, dices el siguiente y seguimos.
