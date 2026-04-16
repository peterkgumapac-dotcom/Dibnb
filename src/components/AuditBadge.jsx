import React from 'react';

export default function AuditBadge({ finding }) {
  const title = `${finding.id} · ${finding.title}\n${finding.description}${
    finding.note ? '\n\n' + finding.note : ''
  }`;
  return (
    <span className={`badge ${finding.severity}`} title={title}>
      {finding.id}
    </span>
  );
}

export function AuditBadges({ findings }) {
  if (!findings || !findings.length) return null;
  return (
    <span className="badges">
      {findings.map((f) => (
        <AuditBadge key={f.id} finding={f} />
      ))}
    </span>
  );
}
