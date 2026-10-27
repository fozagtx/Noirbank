export const ZCASH_TESTNET = {
  cliNetwork: "test",
  displayName: "Zcash testnet",
  lightwalletdServer: "zecrocks",
  lightwalletdHost: "testnet.zec.rocks",
  faucets: [
    { name: "Fauzec", url: "https://fauzec.com/" },
    { name: "Valar testnet faucet", url: "https://faucet.testnet.valargroup.dev/" },
  ],
} as const;
