import React, { useState, useEffect, useCallback } from 'react';
import { AttackTechniqueRef, AttackTechniqueSummary, AttackSuggestion } from '@shared/types/fair';
import api from '../../utils/api';

interface AttackTactic {
  id: string;
  name: string;
  shortname: string;
}

interface Props {
  mode: 'tef' | 'vuln';
  selected: AttackTechniqueRef[];
  onChange: (refs: AttackTechniqueRef[]) => void;
  onApplySuggestion?: (suggestion: AttackSuggestion) => void;
}

export function AttackTechniqueSelector({ mode, selected, onChange, onApplySuggestion }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [tactics, setTactics] = useState<AttackTactic[]>([]);
  const [techniques, setTechniques] = useState<AttackTechniqueSummary[]>([]);
  const [selectedTactic, setSelectedTactic] = useState<string>('');
  const [query, setQuery] = useState('');
  const [includeSubtechniques, setIncludeSubtechniques] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AttackSuggestion | null>(null);
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Check ATT&CK availability
  useEffect(() => {
    api.get('/attack/status')
      .then(r => {
        setAvailable(r.data.available);
        if (r.data.available) {
          api.get('/attack/tactics').then(tr => setTactics(tr.data.tactics ?? []));
        }
      })
      .catch(() => setAvailable(false));
  }, []);

  // Search techniques
  const search = useCallback(() => {
    if (!available) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (selectedTactic) params.set('tactic', selectedTactic);
    params.set('includeSubtechniques', String(includeSubtechniques));
    api.get(`/attack/techniques?${params}`)
      .then(r => setTechniques(r.data.techniques ?? []))
      .finally(() => setLoading(false));
  }, [available, query, selectedTactic, includeSubtechniques]);

  useEffect(() => {
    if (open) search();
  }, [open, search]);

  // Fetch suggestion when selection changes
  useEffect(() => {
    if (!available || selected.length === 0) { setSuggestion(null); return; }
    const endpoint = mode === 'tef' ? '/attack/suggest/tef' : '/attack/suggest/vuln';
    const body = mode === 'tef'
      ? { techniqueIds: selected.map(s => s.techniqueId) }
      : { techniqueRefs: selected };
    api.post(endpoint, body)
      .then(r => setSuggestion(r.data))
      .catch(() => setSuggestion(null));
  }, [available, selected, mode]);

  const addTechnique = (tech: AttackTechniqueSummary) => {
    if (selected.some(s => s.techniqueId === tech.id)) return;
    onChange([...selected, { techniqueId: tech.id, name: tech.name, tactics: tech.tactics }]);
  };

  const removeTechnique = (id: string) => {
    onChange(selected.filter(s => s.techniqueId !== id));
  };

  const updateMitigations = (techniqueId: string, mitigationId: string, checked: boolean) => {
    onChange(selected.map(s => {
      if (s.techniqueId !== techniqueId) return s;
      const current = s.implementedMitigations ?? [];
      const updated = checked
        ? [...current.filter(m => m !== mitigationId), mitigationId]
        : current.filter(m => m !== mitigationId);
      return { ...s, implementedMitigations: updated };
    }));
  };

  if (available === false) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
        <span className="font-semibold">MITRE ATT&CK data not available.</span> Run{' '}
        <code className="font-mono">./install.sh</code> (or <code className="font-mono">install.bat</code>) to
        download the ATT&CK dataset and unlock technique-based suggestions.
      </div>
    );
  }

  if (available === null) {
    return <div className="text-xs text-gray-400 animate-pulse">Checking ATT&CK availability…</div>;
  }

  const isSelected = (id: string) => selected.some(s => s.techniqueId === id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="label">MITRE ATT&CK Techniques</label>
          <p className="text-xs text-gray-500">
            {mode === 'tef'
              ? 'Select techniques to identify the attack pattern and get a suggested Threat Event Frequency range.'
              : 'Select techniques and mark your implemented mitigations to get a Vulnerability estimate.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium flex-shrink-0"
        >
          {open ? '▲ Hide picker' : '▼ Browse techniques'}
        </button>
      </div>

      {/* Selected technique tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(ref => (
            <div key={ref.techniqueId} className="group">
              <div
                className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs cursor-pointer hover:bg-blue-100"
                onClick={() => setExpandedTech(expandedTech === ref.techniqueId ? null : ref.techniqueId)}
              >
                <span className="font-mono font-semibold text-blue-700">{ref.techniqueId}</span>
                <span className="text-blue-800">{ref.name}</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); removeTechnique(ref.techniqueId); }}
                  className="ml-1 text-blue-400 hover:text-red-500"
                >×</button>
              </div>

              {/* Mitigation checklist (vuln mode only) */}
              {mode === 'vuln' && expandedTech === ref.techniqueId && (
                <MitigationChecklist
                  techniqueId={ref.techniqueId}
                  implementedMitigations={ref.implementedMitigations ?? []}
                  onToggle={(mitId, checked) => updateMitigations(ref.techniqueId, mitId, checked)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Suggestion panel */}
      {suggestion && onApplySuggestion && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-green-800">
            {mode === 'tef' ? 'Suggested TEF Range' : 'Suggested Vulnerability Range'}
          </div>
          <div className="text-xs text-green-700">{suggestion.rationale}</div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-green-800">
              Triangular: {suggestion.parameters.min} → {suggestion.parameters.mode} → {suggestion.parameters.max}
              {mode === 'tef' ? ' events/year' : ' (probability)'}
            </span>
            <button
              type="button"
              onClick={() => onApplySuggestion(suggestion)}
              className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
            >
              Apply suggestion
            </button>
          </div>
        </div>
      )}

      {/* Technique picker */}
      {open && (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          {/* Tactic filter bar */}
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedTactic('')}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                  !selectedTactic ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >All tactics</button>
              {tactics.map(t => (
                <button
                  key={t.shortname}
                  type="button"
                  onClick={() => setSelectedTactic(t.shortname === selectedTactic ? '' : t.shortname)}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                    selectedTactic === t.shortname
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                className="input text-sm flex-1"
                placeholder="Search by name or ID (e.g. T1566)…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 flex-shrink-0">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5"
                  checked={includeSubtechniques}
                  onChange={e => setIncludeSubtechniques(e.target.checked)}
                />
                Sub-techniques
              </label>
              <button type="button" onClick={search} className="btn-secondary text-xs">Search</button>
            </div>
          </div>

          {/* Technique list */}
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {loading && (
              <div className="p-4 text-center text-xs text-gray-400 animate-pulse">Loading…</div>
            )}
            {!loading && techniques.length === 0 && (
              <div className="p-4 text-center text-xs text-gray-400">
                {query || selectedTactic ? 'No techniques match your search.' : 'Use the search or tactic filter above.'}
              </div>
            )}
            {!loading && techniques.map(tech => (
              <div
                key={tech.id}
                className={`flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors ${
                  tech.isSubtechnique ? 'pl-6' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-gray-500">{tech.id}</span>
                    <span className="text-sm text-gray-800 truncate">{tech.name}</span>
                    {tech.prevalenceTier && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        tech.prevalenceTier === 1 ? 'bg-red-100 text-red-700' :
                        tech.prevalenceTier === 2 ? 'bg-orange-100 text-orange-700' :
                        tech.prevalenceTier === 3 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        T{tech.prevalenceTier}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-2 flex-wrap">
                    {tech.tacticNames?.slice(0, 3).map(t => (
                      <span key={t} className="bg-gray-100 px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                    {tech.platforms?.slice(0, 3).map(p => (
                      <span key={p} className="text-gray-400">{p}</span>
                    ))}
                    {tech.groupCount > 0 && (
                      <span className="text-gray-400">{tech.groupCount} group{tech.groupCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSelected(tech.id)}
                  onClick={() => addTechnique(tech)}
                  className={`flex-shrink-0 text-xs px-2 py-1 rounded border transition-colors ${
                    isSelected(tech.id)
                      ? 'bg-green-50 text-green-600 border-green-200 cursor-default'
                      : 'bg-white text-brand-600 border-brand-300 hover:bg-brand-50'
                  }`}
                >
                  {isSelected(tech.id) ? '✓ Added' : '+ Add'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mitigation checklist sub-component ──────────────────────

interface MitigationChecklistProps {
  techniqueId: string;
  implementedMitigations: string[];
  onToggle: (mitigationId: string, checked: boolean) => void;
}

function MitigationChecklist({ techniqueId, implementedMitigations, onToggle }: MitigationChecklistProps) {
  const [mitigations, setMitigations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/attack/techniques/${techniqueId}`)
      .then(r => setMitigations(r.data.mitigations ?? []))
      .catch(() => setMitigations([]))
      .finally(() => setLoading(false));
  }, [techniqueId]);

  if (loading) return <div className="text-xs text-gray-400 mt-1 pl-2 animate-pulse">Loading mitigations…</div>;
  if (mitigations.length === 0) return <div className="text-xs text-gray-400 mt-1 pl-2">No mitigations listed for this technique.</div>;

  const implemented = implementedMitigations.length;
  const total = mitigations.length;

  return (
    <div className="mt-1 ml-1 border-l-2 border-blue-200 pl-3 py-1 bg-white rounded-b space-y-1">
      <div className="text-xs font-medium text-gray-600 mb-1.5">
        ATT&CK Mitigations — {implemented}/{total} implemented
        <div className="h-1 bg-gray-200 rounded mt-1">
          <div
            className="h-1 bg-green-500 rounded"
            style={{ width: `${total > 0 ? (implemented / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      {mitigations.map(m => (
        <label key={m.id} className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 hover:text-gray-900">
          <input
            type="checkbox"
            className="w-3.5 h-3.5 text-brand-600 rounded"
            checked={implementedMitigations.includes(m.id)}
            onChange={e => onToggle(m.id, e.target.checked)}
          />
          <span className="font-mono text-gray-400">{m.id}</span>
          <span>{m.name}</span>
        </label>
      ))}
    </div>
  );
}
