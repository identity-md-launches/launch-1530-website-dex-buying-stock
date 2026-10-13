import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  LogOut,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import type { WalletState } from "../lib/wallet";
import { EXPLORER } from "../lib/chain";
import { Modal } from "./Modal";
export function WalletModal({
  wallet,
  onClose,
}: {
  wallet: WalletState;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const available = wallet.options.length
    ? wallet.options
    : window.ethereum
      ? [
          {
            info: { uuid: "injected", name: "Browser wallet", rdns: "" },
            provider: window.ethereum,
          },
        ]
      : [];
  return (
    <Modal
      title={wallet.account ? "Your wallet" : "Connect a wallet"}
      onClose={onClose}
      busy={wallet.busy}
    >
      {wallet.account ? (
        <>
          <div className="wallet-emblem">
            <Wallet size={28} />
          </div>
          <p className="center muted">
            Connected to{" "}
            {wallet.chain === 1 ? "Ethereum" : `network ${wallet.chain}`}
          </p>
          <code className="full-address">{wallet.account}</code>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(wallet.account!);
                  setCopied(true);
                } catch {
                  setCopyError(
                    "Copy unavailable. Select and copy the address above.",
                  );
                }
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
              {copied ? "Copied" : "Copy address"}
            </button>
            <a
              className="button secondary"
              href={`${EXPLORER}/address/${wallet.account}`}
              target="_blank"
              rel="noreferrer"
            >
              Etherscan <ExternalLink size={16} />
            </a>
          </div>
          {copyError && (
            <p role="status" className="field-error">
              {copyError}
            </p>
          )}
          {wallet.chain !== 1 && (
            <button
              className="button primary full-width"
              disabled={wallet.busy}
              onClick={() => void wallet.switchNetwork()}
            >
              {wallet.busy ? "Switching network…" : "Switch to Ethereum"}
            </button>
          )}
          <button
            className="button text-button full-width"
            onClick={() => {
              wallet.disconnect();
              onClose();
            }}
          >
            <LogOut size={16} /> Disconnect
          </button>
          <p className="fineprint">
            Disconnecting ends this session. It does not revoke existing token
            allowances.
          </p>
        </>
      ) : (
        <>
          <p className="modal-intro">
            Use your Ethereum wallet to buy tokenized stocks with IMD.
          </p>
          <div className="wallet-options">
            {available.map((option) => (
              <button
                className="wallet-option"
                key={option.info.uuid}
                disabled={wallet.busy}
                onClick={async () => {
                  if (await wallet.connect(option.provider)) onClose();
                }}
              >
                <span className="wallet-symbol">
                  <Wallet size={22} />
                </span>
                <span>{option.info.name}</span>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
          {!available.length && (
            <div className="empty-wallet">
              <Wallet size={32} />
              <h3>No wallet detected</h3>
              <p>
                Open this site in your wallet’s browser, or install a browser
                wallet and reload.
              </p>
              <a
                className="button secondary"
                href="https://ethereum.org/en/wallets/find-wallet/"
                target="_blank"
                rel="noreferrer"
              >
                Find an Ethereum wallet <ArrowUpRight size={16} />
              </a>
              <button
                className="button text-button"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            </div>
          )}
          {wallet.busy && (
            <p role="status" className="notice">
              Check your wallet to approve the connection.
            </p>
          )}
          <p className="fineprint">
            Connecting only shares your public address. Every transaction needs
            your approval.
          </p>
        </>
      )}
      <div role="alert">
        {wallet.error && <p className="field-error">{wallet.error}</p>}
      </div>
    </Modal>
  );
}
