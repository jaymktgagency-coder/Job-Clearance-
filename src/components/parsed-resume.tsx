/**
 * parsed-resume.tsx — "here's what we read from your resume".
 *
 * Plain English: after the AI reads a resume, this shows the seeker exactly
 * what it took away. That's the point of it. A hiring tool that reads your
 * documents and then won't tell you what it thinks it saw is a tool you can't
 * argue with — and if the AI misread something, the seeker is the only person
 * who can spot it.
 */

type Position = {
  title?: string | null;
  employer?: string | null;
  start?: string | null;
  end?: string | null;
  highlights?: string[] | null;
};

type Education = {
  qualification?: string | null;
  institution?: string | null;
  year?: string | null;
};

export type ParsedResumeShape = {
  headline?: string | null;
  location?: string | null;
  years_experience?: number | null;
  summary?: string | null;
  skills?: string[] | null;
  positions?: Position[] | null;
  education?: Education[] | null;
  certifications?: string[] | null;
  languages?: string[] | null;
};

/** Joins the bits of a line that actually exist, e.g. "Barista — Northgate". */
function line(parts: (string | null | undefined)[], separator = " · "): string {
  return parts.filter((p) => p && String(p).trim()).join(separator);
}

export function ParsedResume({ parsed }: { parsed: ParsedResumeShape }) {
  const positions = parsed.positions ?? [];
  const education = parsed.education ?? [];
  const skills = parsed.skills ?? [];
  const certifications = parsed.certifications ?? [];
  const languages = parsed.languages ?? [];

  return (
    <div className="space-y-4 text-sm" data-testid="parsed-resume">
      {parsed.summary ? <p className="text-muted-foreground">{parsed.summary}</p> : null}

      {line([parsed.headline, parsed.location, parsed.years_experience != null ? `${parsed.years_experience} years` : null]) ? (
        <p>{line([parsed.headline, parsed.location, parsed.years_experience != null ? `${parsed.years_experience} years` : null])}</p>
      ) : null}

      {positions.length > 0 ? (
        <div>
          <p className="font-medium">Jobs we found</p>
          <ul className="mt-1 space-y-2">
            {positions.map((job, i) => (
              <li key={i}>
                <span>{line([job.title, job.employer], " — ") || "A role"}</span>
                {line([job.start, job.end], " to ") ? (
                  <span className="text-muted-foreground"> ({line([job.start, job.end], " to ")})</span>
                ) : null}
                {job.highlights?.length ? (
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {job.highlights.map((h, j) => (
                      <li key={j}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {skills.length > 0 ? (
        <p>
          <span className="font-medium">Skills:</span>{" "}
          <span className="text-muted-foreground">{skills.join(", ")}</span>
        </p>
      ) : null}

      {certifications.length > 0 ? (
        <p>
          <span className="font-medium">Certificates and licences:</span>{" "}
          <span className="text-muted-foreground">{certifications.join(", ")}</span>
        </p>
      ) : null}

      {education.length > 0 ? (
        <p>
          <span className="font-medium">Education:</span>{" "}
          <span className="text-muted-foreground">
            {education.map((e) => line([e.qualification, e.institution, e.year])).filter(Boolean).join("; ")}
          </span>
        </p>
      ) : null}

      {languages.length > 0 ? (
        <p>
          <span className="font-medium">Languages:</span>{" "}
          <span className="text-muted-foreground">{languages.join(", ")}</span>
        </p>
      ) : null}
    </div>
  );
}
