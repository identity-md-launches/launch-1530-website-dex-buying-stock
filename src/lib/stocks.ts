import type { Address } from "viem";

export type Sector =
  | "Technology"
  | "Consumer"
  | "Healthcare"
  | "Financials"
  | "Industrials"
  | "Energy";
export type Stock = {
  rank: number;
  symbol: string;
  name: string;
  address: Address;
  sector: Sector;
  color: string;
};
const rows: [string, string, Address, Sector][] = [
  [
    "AAPLon",
    "Apple",
    "0x14c3abF95Cb9C93a8b82C1CdCB76D72Cb87b2d4c",
    "Technology",
  ],
  [
    "NVDAon",
    "NVIDIA",
    "0x2D1F7226Bd1F780AF6B9A49DCC0aE00E8Df4bDEE",
    "Technology",
  ],
  ["TSLAon", "Tesla", "0xf6b1117ec07684D3958caD8BEb1b302bfD21103f", "Consumer"],
  [
    "MSFTon",
    "Microsoft",
    "0xB812837b81a3a6b81d7CD74CfB19A7f2784555E5",
    "Technology",
  ],
  [
    "AMZNon",
    "Amazon",
    "0xbb8774FB97436d23d74C1b882E8E9A69322cFD31",
    "Consumer",
  ],
  ["AMDon", "AMD", "0x0C1f3412A44Ff99E40bF14e06e5Ea321aE7B3938", "Technology"],
  [
    "PLTRon",
    "Palantir",
    "0x0c666485b02F7A87d21AdD7AEb9F5e64975AA490",
    "Technology",
  ],
  [
    "GMEon",
    "GameStop",
    "0x71d24Baeb0A033ec5F90FF65C4210545AF378D97",
    "Consumer",
  ],
  [
    "UBERon",
    "Uber",
    "0x5Bcd8195E3Ef58f677aeF9eBC276B5087c027050",
    "Industrials",
  ],
  ["NKEon", "Nike", "0xD8e26FcC879b30cB0a0B543925a2B3500f074D81", "Consumer"],
  [
    "PFEon",
    "Pfizer",
    "0x06954faa913fA14c28Eb1b2e459594F22f33f3dE",
    "Healthcare",
  ],
  [
    "PYPLon",
    "PayPal",
    "0x4EFD92F372898B57F292De69fCe377dd7D912bDd",
    "Financials",
  ],
  [
    "ABTon",
    "Abbott",
    "0x3859385363f7BB4Dfe42811cCF3F294FcD41dd1D",
    "Healthcare",
  ],
  [
    "NVOon",
    "Novo Nordisk",
    "0x28151F5888833D3d767C4d6945a0Ee50D1B193E3",
    "Healthcare",
  ],
  [
    "INTCon",
    "Intel",
    "0xFdA09936DbD717368De0835bA441d9E62069d36f",
    "Technology",
  ],
  [
    "SMCIon",
    "Super Micro Computer",
    "0x2ca12a3F9635fD69C21580def14F25C210cA9612",
    "Technology",
  ],
  [
    "MRVLon",
    "Marvell Technology",
    "0xF404E5f887dBd5508e16a1198fCDD5DE1A4296B8",
    "Technology",
  ],
  [
    "QCOMon",
    "Qualcomm",
    "0xE3419710c1f77D44B4DaB02316d3f048818C4E59",
    "Technology",
  ],
  [
    "SBUXon",
    "Starbucks",
    "0xf15FbC1349ab99ABAd63db3f9A510BF413bE3BeF",
    "Consumer",
  ],
  [
    "ABNBon",
    "Airbnb",
    "0xb035c3d5083bdc80074F380aeBc9Fcb68aBa0A28",
    "Consumer",
  ],
  [
    "CSCOon",
    "Cisco Systems",
    "0x980a1001ee94e54142b231f44C7CA7c9DF71FBe1",
    "Technology",
  ],
  [
    "CMGon",
    "Chipotle",
    "0x25018520138bbaB60684AD7983D4432E8B8E926B",
    "Consumer",
  ],
  [
    "KOon",
    "Coca-Cola",
    "0x74a03d741226f738098C35da8188E57acA50d146",
    "Consumer",
  ],
  [
    "WMTon",
    "Walmart",
    "0x82106347dDbB23cE44Cf4cE4053Ef1adf8b9323B",
    "Consumer",
  ],
  ["TMon", "Toyota", "0xaB02fc332e9278eBCbbC6B4a8038050c01D15F69", "Consumer"],
  [
    "SHOPon",
    "Shopify",
    "0x908266C1192628371Cff7AD2F5Eba4dE061a0ac5",
    "Technology",
  ],
  [
    "RDDTon",
    "Reddit",
    "0xA9431d354cFAD3c6B76E50f0e73b43D48Be80CD0",
    "Technology",
  ],
  ["DISon", "Disney", "0xc3D93B45249E8E06cfeB01d25A96337E8893265d", "Consumer"],
  [
    "PEPon",
    "PepsiCo",
    "0x3cE219D498D807317F840f4CB0f03FA27dd65046",
    "Consumer",
  ],
  [
    "WFCon",
    "Wells Fargo",
    "0x4AD2118Da8a65eaa81402A3d583FEF6eE76BDf3F",
    "Financials",
  ],
  [
    "BIDUon",
    "Baidu",
    "0x9d4C6AD12B55E4645b585209F90Cc26614061E91",
    "Technology",
  ],
  [
    "ORCLon",
    "Oracle",
    "0x8a23C6BaadB88512b30475C83Df6A63881e33e1E",
    "Technology",
  ],
  [
    "PGon",
    "Procter & Gamble",
    "0x339ce23a355ed6D513DD3e1462975C4eCD86823a",
    "Consumer",
  ],
  [
    "CRCLon",
    "Circle Internet Group",
    "0x3632DEa96A953C11dac2f00b4A05a32CD1063fAE",
    "Financials",
  ],
  [
    "SPGIon",
    "S&P Global",
    "0xbc843b147DB4C7E00721d76037b8b92e13AfE13f",
    "Financials",
  ],
  ["CVXon", "Chevron", "0x8F3E41b378ae010c46d255F36bFC1D303b52dceb", "Energy"],
  [
    "TSMon",
    "Taiwan Semiconductor (TSMC)",
    "0x3Cafdbfe682aec17d5acE2f97A2f3ab3dCf6a4A9",
    "Technology",
  ],
  [
    "PANWon",
    "Palo Alto Networks",
    "0x34bfdFF25F0fdA6d3ad0c33F1e06c0D40bD68885",
    "Technology",
  ],
  [
    "BABAon",
    "Alibaba",
    "0x41765F0FCddC276309195166C7A62AE522FA09ef",
    "Consumer",
  ],
  [
    "AVGOon",
    "Broadcom",
    "0x0d54D4279B9E8c54cD8547c2C75A8Ee81A0BcaE8",
    "Technology",
  ],
  [
    "JPMon",
    "JPMorgan Chase",
    "0x03C1EC4CA9DBb168E6Db0DeF827c085999CBffaF",
    "Financials",
  ],
  [
    "CRMon",
    "Salesforce",
    "0x55720eF5b023Fd043AE5F8D2e526030207978950",
    "Technology",
  ],
  [
    "COINon",
    "Coinbase",
    "0xF042cfa86cf1D598a75Bdb55c3507a1F39f9493b",
    "Financials",
  ],
  [
    "BAon",
    "Boeing",
    "0x57270D35A840BC5C094da6FBeCA033FB71eA6Ab0",
    "Industrials",
  ],
  [
    "GEon",
    "General Electric",
    "0xD904bCf89B7CedF5c89f9Df7e829191D695F847E",
    "Industrials",
  ],
  [
    "APPon",
    "AppLovin",
    "0xd5C5B2883735Fa9B658Dd52e2FCC8d7c0f1A42Ce",
    "Technology",
  ],
  [
    "MAon",
    "Mastercard",
    "0xA29dC2102dfc2a0A4A5dCb84Af984315567c9858",
    "Financials",
  ],
  [
    "LMTon",
    "Lockheed Martin",
    "0x691b126cF619707Ed5d16CaB1B27C000aa8De300",
    "Industrials",
  ],
  [
    "MCDon",
    "McDonald's",
    "0x4C82c8cD9a218612DCe60b156B73A36705645e3b",
    "Consumer",
  ],
  [
    "MSTRon",
    "Strategy (MicroStrategy)",
    "0xCabD955322dfbf94C084929ac5E9Eca3fEB5556F",
    "Technology",
  ],
];
const colors: Record<Sector, string> = {
  Technology: "sage",
  Consumer: "sand",
  Healthcare: "blue",
  Financials: "violet",
  Industrials: "slate",
  Energy: "sand",
};
export const stocks: Stock[] = rows.map(
  ([symbol, name, address, sector], i) => ({
    rank: i + 1,
    symbol,
    name,
    address,
    sector,
    color: colors[sector],
  }),
);
export const sectors: Sector[] = [
  "Technology",
  "Consumer",
  "Healthcare",
  "Financials",
  "Industrials",
  "Energy",
];
