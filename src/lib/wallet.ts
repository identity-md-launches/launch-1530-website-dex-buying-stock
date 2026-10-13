import { useEffect, useState } from "react";
import type { Address, EIP1193Provider } from "viem";
import { isAddress } from "viem";
import { friendlyError } from "./chain";
export type Provider = EIP1193Provider & {
  on?: (name: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    name: string,
    listener: (...args: unknown[]) => void,
  ) => void;
};
export type WalletOption = {
  info: { uuid: string; name: string; rdns: string };
  provider: Provider;
};
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
export function useWallet() {
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [provider, setProvider] = useState<Provider>();
  const [account, setAccount] = useState<Address>();
  const [chain, setChain] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const announce = (event: Event) => {
      const item = (event as CustomEvent<WalletOption>).detail;
      if (!item?.provider?.request || !item.info?.uuid) return;
      setOptions((prev) =>
        prev.some((p) => p.info.uuid === item.info.uuid)
          ? prev
          : [...prev, item],
      );
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () =>
      window.removeEventListener("eip6963:announceProvider", announce);
  }, []);
  useEffect(() => {
    if (!provider) return;
    const accountsChanged = (...args: unknown[]) => {
      const a = args[0] as string[];
      setAccount(a?.[0] && isAddress(a[0]) ? (a[0] as Address) : undefined);
    };
    const chainChanged = (...args: unknown[]) => setChain(Number(args[0]));
    const disconnected = () => {
      setAccount(undefined);
      setChain(undefined);
    };
    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);
    provider.on?.("disconnect", disconnected);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
      provider.removeListener?.("disconnect", disconnected);
    };
  }, [provider]);
  const connect = async (next: Provider) => {
    setBusy(true);
    setError("");
    try {
      const accounts = await next.request({ method: "eth_requestAccounts" });
      if (!accounts[0] || !isAddress(accounts[0]))
        throw new Error(
          "No account was shared. Unlock your wallet and try again.",
        );
      const chainId = await next.request({ method: "eth_chainId" });
      setProvider(next);
      setAccount(accounts[0]);
      setChain(Number(chainId));
      return true;
    } catch (e) {
      setError(friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const switchNetwork = async () => {
    if (!provider) return;
    setBusy(true);
    setError("");
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }],
      });
      setChain(Number(await provider.request({ method: "eth_chainId" })));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return {
    options,
    provider,
    account,
    chain,
    busy,
    error,
    setError,
    connect,
    switchNetwork,
    disconnect: () => {
      setProvider(undefined);
      setAccount(undefined);
      setChain(undefined);
      setError("");
    },
  };
}
export type WalletState = ReturnType<typeof useWallet>;
