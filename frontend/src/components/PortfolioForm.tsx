import { FormEvent, useMemo, useState } from 'react';
import { PortfolioAssetInput } from '../types';
import { Card } from './Card';

interface PortfolioFormProps {
  loading: boolean;
  onSubmit: (name: string, assets: PortfolioAssetInput[]) => Promise<void>;
}

const DEFAULT_ASSETS: PortfolioAssetInput[] = [
  { symbol: 'AAPL', weight: 0.4, quantity: 120 },
  { symbol: 'MSFT', weight: 0.35, quantity: 80 },
  { symbol: 'NVDA', weight: 0.25, quantity: 25 },
];

function toNumber(value: string): number {
  if (!value.trim()) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function PortfolioForm({ loading, onSubmit }: PortfolioFormProps) {
  const [name, setName] = useState('Growth Blend Portfolio');
  const [assets, setAssets] = useState<PortfolioAssetInput[]>(DEFAULT_ASSETS);
  const [error, setError] = useState<string | null>(null);

  const totalWeight = useMemo(
    () => assets.reduce((sum, asset) => sum + Number(asset.weight || 0), 0),
    [assets],
  );

  const hasValidWeight = Math.abs(totalWeight - 1) <= 0.0001;

  const updateAsset = (index: number, key: keyof PortfolioAssetInput, value: string) => {
    setAssets((prev) =>
      prev.map((asset, idx) => {
        if (idx !== index) {
          return asset;
        }

        if (key === 'symbol') {
          return { ...asset, symbol: value.toUpperCase() };
        }

        return {
          ...asset,
          [key]: toNumber(value),
        };
      }),
    );
  };

  const addAsset = () => {
    setAssets((prev) => [...prev, { symbol: '', weight: 0, quantity: 0 }]);
  };

  const removeAsset = (index: number) => {
    setAssets((prev) => prev.filter((_, idx) => idx !== index));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasValidWeight) {
      setError('Total weight must equal 1.0000 before analysis.');
      return;
    }

    if (assets.some((asset) => !asset.symbol.trim())) {
      setError('Each row requires a stock symbol.');
      return;
    }

    setError(null);
    await onSubmit(name.trim(), assets);
  };

  return (
    <Card
      title="Portfolio Setup"
      subtitle="Define allocation by symbol, weight, and optional quantity. Weights must sum to 1.0000."
      className="lg:sticky lg:top-6"
      contentClassName="space-y-6"
    >
      <form onSubmit={submit} className="space-y-6">
        <label className="block">
          <span className="field-label">Portfolio Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
            placeholder="Enter a portfolio name"
            required
          />
        </label>

        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="text-slate-600">
                  <th className="px-3 py-3 font-semibold">Symbol</th>
                  <th className="px-3 py-3 font-semibold">Weight</th>
                  <th className="px-3 py-3 font-semibold">Quantity</th>
                  <th className="px-3 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset, index) => (
                  <tr key={`${asset.symbol || 'asset'}-${index}`} className="border-t border-slate-100">
                    <td className="p-3">
                      <input
                        value={asset.symbol}
                        onChange={(e) => updateAsset(index, 'symbol', e.target.value)}
                        className="field-input h-10"
                        aria-label={`Symbol row ${index + 1}`}
                        maxLength={10}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={asset.weight}
                        onChange={(e) => updateAsset(index, 'weight', e.target.value)}
                        className="field-input h-10"
                        aria-label={`Weight row ${index + 1}`}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={asset.quantity}
                        onChange={(e) => updateAsset(index, 'quantity', e.target.value)}
                        className="field-input h-10"
                        aria-label={`Quantity row ${index + 1}`}
                      />
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => removeAsset(index)}
                        disabled={assets.length === 1 || loading}
                        className={`btn-danger ${assets.length === 1 || loading ? 'btn-disabled' : ''}`}
                        aria-label={`Remove asset row ${index + 1}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={addAsset}
              disabled={loading}
              className={`btn-secondary ${loading ? 'btn-disabled' : ''}`}
            >
              Add Asset
            </button>

            <p
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                hasValidWeight ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              Total Weight: {totalWeight.toFixed(4)}
            </p>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={`btn-primary w-full ${loading ? 'btn-disabled' : ''}`}
        >
          {loading ? 'Running Analysis...' : 'Save Portfolio and Run Analysis'}
        </button>
      </form>
    </Card>
  );
}
