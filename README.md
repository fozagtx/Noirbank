# Noirbank — private agentic banking on Zcash

Noirbank is private agentic banking on Zcash, built for the ZECATHON Shielded Payments track. Your AI agents get their own shielded accounts with mandates. They request payments; you approve them.

## Trust model

- Agents do not receive wallet keys and cannot approve or broadcast payments.
- Wallet operations run server-side through `zcash-devtool`. The wallet database and age identity are stored in `data/vault` by default. Protect this self-hosted machine and its files.
- Mandate limits and approval checks are application logic, not Zcash consensus rules. Anyone who controls the server or vault can change or bypass them.
- Zcash shielded transactions protect on-chain details, but a viewing key can reveal transaction activity to whoever receives it. Noirbank only returns a viewing key after an explicit owner action.
- This prototype targets Zcash testnet only. It has no authentication layer; do not expose an instance to an untrusted network.
- Balances, addresses, and transaction IDs are read from the actual wallet. Before chain data exists, the interface shows an honest empty or unavailable state.

## Quick start

### 1. Build `zcash-devtool`

Install Rust and the platform build dependencies, then build the wallet CLI:

```sh
git clone https://github.com/zcash/zcash-devtool.git
cd zcash-devtool
cargo build --release
```

Make `target/release/zcash-devtool` available on `PATH`, or set `NOIRBANK_DEVTOOL_BIN` to its absolute path.

### 2. Start Noirbank

From the Noirbank repository:

```sh
pnpm install
pnpm dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123) and choose **Open your bank**. The app creates a testnet Treasury account in `data/vault`, using the `zecrocks` lightwalletd server (`testnet.zec.rocks`). No environment variables are required to use the defaults.

### 3. Fund and use an agent account

1. Copy the Treasury unified address or scan its QR code and request testnet funds from [Fauzec](https://fauzec.com/) or the [Valar testnet faucet](https://faucet.testnet.valargroup.dev/).
2. Open an agent account from **Accounts**. The Payroll clerk, Tips bot, and API spender templates prefill a software mandate; they do not grant the agent a key.
3. Add a recipient unified address under **Payees**, then select it in the agent's mandate allowlist.
4. Fund the agent from Treasury with an owner-initiated shielded transfer. Wait for confirmations and refresh from chain.
5. Enter an instruction for the agent. Review the resulting proposal under **Approvals**; approval rechecks its mandate and spendable balance, then broadcasts a real testnet send.
6. Review wallet transactions and the audit trail under **Statements**. Reveal a viewing key only when an accountant or auditor needs it.

## Configuration

Defaults are committed public testnet configuration: network `test`, server alias `zecrocks`, host `testnet.zec.rocks`, and the faucet URLs above. Optional overrides:

| Variable | Purpose |
| --- | --- |
| `NOIRBANK_DEVTOOL_BIN` | `zcash-devtool` executable; defaults to `zcash-devtool` on `PATH` |
| `NOIRBANK_VAULT_DIR` | Wallet vault directory; defaults to `data/vault` |
| `NOIRBANK_LIGHTWALLETD_SERVER` | Lightwalletd server alias; defaults to `zecrocks` |
| `OPENAI_API_KEY` | Optional OpenAI-based instruction parsing |
| `OPENAI_MODEL` | Optional model name for instruction parsing |

The CLI calls are serialized by the server to avoid concurrent access to its SQLite wallet. Chain sync is single-flight and throttled to at most once every 30 seconds unless the owner requests a refresh.

## Development

```sh
pnpm lint
pnpm test
pnpm build
```

Do not commit `data/vault`; it contains sensitive wallet material.
