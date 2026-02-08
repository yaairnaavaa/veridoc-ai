# Retiro USDT a Solana y Arbitrum

## Cómo funciona el retiro (intent)

En NEAR Intents, el **withdrawal se hace mediante un intent**: la app crea y firma un intent que indica el activo, la cantidad y la dirección destino en la cadena elegida; el SDK lo publica en el relayer y, una vez liquidado en NEAR, el bridge (POA u Omni) envía los fondos a la cadena destino. Es decir: **intent → firma → publicación → liquidación en NEAR → bridge a la cadena**. El SDK (`processWithdrawal` → `createWithdrawIntentPrimitive`) construye ese intent; no se hace una transferencia directa desde la app al bridge.

## Resumen: NEAR Intents sí soporta retiros a Solana y Arbitrum

La documentación de NEAR Intents ([Chain Support](https://docs.near-intents.org/near-intents/chain-address-support)) confirma soporte para **Arbitrum** (EVM) y **Solana**. Los retiros cross-chain pueden usar dos mecanismos según el token:

1. **Omni bridge** (`omni.bridge.near`): tokens NEP-141 “genéricos” (p. ej. **USDT nativo** `usdt.tether-token.near`). El mapeo a cada cadena lo define el contrato Omni; si no tiene USDT para una cadena, el SDK devuelve *"token doesn't exist in destination network"*.
2. **Passive Deposit/Withdrawal Service (POA)** (`bridge.chaindefuser.com`): tokens **POA** (`.omft.near`). Este servicio **sí tiene USDT para Arbitrum y Solana**, pero como tokens envueltos por POA, no como USDT nativo.

## Verificación con la API POA

Llamada a `POST https://bridge.chaindefuser.com/rpc` con `method: "supported_tokens"` y `params: [{ "chains": ["eth:42161", "sol:mainnet"] }]` devuelve, entre otros:

- **Arbitrum USDT**: `near_token_id`: `arb-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9.omft.near`, `intents_token_id`: `nep141:arb-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9.omft.near`
- **Solana USDT**: `near_token_id`: `sol-c800a4bd850783ccb82c2b2c7e84175443606352.omft.near`, `intents_token_id`: `nep141:sol-c800a4bd850783ccb82c2b2c7e84175443606352.omft.near`

Es decir: el **bridge POA** (otro bridge distinto de Omni) sí soporta retiros de USDT a Arbitrum y Solana, usando esos contratos `.omft.near`.

## Situación en nuestra app

- **Omni** no tiene USDT nativo (`usdt.tether-token.near`) mapeado para Ethereum, Base, Arbitrum ni Solana (el SDK lanza "token doesn't exist in destination network"). Por eso usamos **POA** para cross-chain USDT.
- **Ethereum, Arbitrum y Solana**: retiros con **POA** y los asset IDs de USDT POA:
  - Ethereum: `nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near`
  - Arbitrum: `nep141:arb-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9.omft.near`
  - Solana: `nep141:sol-c800a4bd850783ccb82c2b2c7e84175443606352.omft.near`
- **Base**: por ahora Omni (puede fallar si Omni no tiene USDT); en el futuro se puede pasar a POA si hay USDT para Base en la API POA.
- El usuario debe tener **saldo en el token POA** de la cadena destino (haber depositado USDT desde esa cadena vía POA). Si solo tiene USDT nativo en NEAR, solo puede retirar a NEAR (ft_withdraw).

## Qué hace la app

- `getRouteConfigForNetwork()` devuelve **POA** para Ethereum, Arbitrum y Solana; Base sigue con Omni.
- En la UI se muestra una nota para cross-chain: hace falta USDT depositado desde esa cadena (POA).

## Referencias

- [Passive Deposit/Withdrawal Service](https://docs.near-intents.org/near-intents/market-makers/passive-deposit-withdrawal-service): endpoint `https://bridge.chaindefuser.com/rpc`, método `supported_tokens`.
- [Chain Support](https://docs.near-intents.org/near-intents/chain-address-support): cadenas soportadas (incl. Arbitrum, Solana).
- Omni: contrato `omni.bridge.near`, view `get_bridged_token`; [Omni Bridge Overview](https://docs.near.org/chain-abstraction/omnibridge/overview).

## Error "base58: invalid character '0' at byte 8" (Ethereum/Arbitrum)

Si al retirar a Ethereum o Arbitrum ves un error del estilo **"Failed to publish intent"** con **"base58: provided string contained invalid character '0' at byte 8"**, es un fallo conocido del Verifier/relayer: al deserializar el intent de POA, algo intenta decodificar en base58 el `receiver_id` (p. ej. `eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near`) o el memo con la dirección 0x…; base58 no admite el carácter '0'. Conviene reportarlo a NEAR Intents / Defuse (incluir el payload del error). Mientras tanto, usar solo retiro a **NEAR** desde la app.

## Mantenimiento

- Para **quitar** Solana o Arbitrum del selector: eliminar su `case` en `getRouteConfigForNetwork()` y su entrada en `USDT_WITHDRAW_SUPPORTED_NETWORK_IDS`.
- Para **añadir** otra red soportada por Omni: añadir el `case` y la entrada en el array.
- Si en el futuro la app gestiona también saldo en tokens POA (p. ej. USDT vía POA desde Arbitrum/Solana), se podría usar `routeConfig: { route: "poa_bridge", chain }` y el `assetId` correspondiente (p. ej. `nep141:arb-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9.omft.near`) para retiros a esas cadenas.
