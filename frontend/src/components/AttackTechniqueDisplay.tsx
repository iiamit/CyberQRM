import React, { useState } from 'react';
import { AttackTechniqueRef } from '@shared/types/fair';

interface Props {
  techniques: AttackTechniqueRef[];
  label?: string;
}

export function AttackTechniqueDisplay({ techniques, label }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!techniques || techniques.length === 0) return null;

  return (
    <div className="space-y-2">
      {label && <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>}
      <div className="flex flex-wrap gap-2">
        {techniques.map(ref => (
          <div key={ref.techniqueId} className="inline-block">
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === ref.techniqueId ? null : ref.techniqueId)}
              className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs hover:bg-blue-100 transition-colors"
            >
              <span className="font-mono font-semibold text-blue-700">{ref.techniqueId}</span>
              <span className="text-blue-800">{ref.name}</span>
              {ref.tactics?.length > 0 && (
                <span className="text-blue-400">· {ref.tactics[0].replace(/-/g, ' ')}</span>
              )}
              <span className="text-blue-400">{expandedId === ref.techniqueId ? '▲' : '▼'}</span>
            </button>

            {expandedId === ref.techniqueId && (
              <div className="mt-1 ml-1 border border-blue-100 rounded-lg bg-white p-3 text-xs space-y-2 shadow-sm w-80">
                <div className="flex items-center justify-between">
                  <a
                    href={`https://attack.mitre.org/techniques/${ref.techniqueId.replace('.', '/')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-semibold text-blue-600 hover:underline"
                  >
                    {ref.techniqueId} ↗
                  </a>
                  <span className="text-gray-500">{ref.name}</span>
                </div>

                {ref.tactics?.length > 0 && (
                  <div>
                    <span className="text-gray-400 mr-1">Tactics:</span>
                    {ref.tactics.map(t => (
                      <span key={t} className="inline-block bg-gray-100 rounded px-1.5 py-0.5 mr-1 capitalize">
                        {t.replace(/-/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {ref.implementedMitigations && ref.implementedMitigations.length > 0 && (
                  <div>
                    <span className="text-gray-400 block mb-1">Mitigations implemented:</span>
                    {ref.implementedMitigations.map(m => (
                      <span key={m} className="inline-block bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5 mr-1 font-mono">
                        {m}
                      </span>
                    ))}
                  </div>
                )}

                {ref.rationale && (
                  <div>
                    <span className="text-gray-400 block">Rationale:</span>
                    <span className="text-gray-700">{ref.rationale}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
