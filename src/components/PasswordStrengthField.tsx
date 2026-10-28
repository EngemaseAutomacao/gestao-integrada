import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Check, X } from "lucide-react";

type Requirement = {
  label: string;
  test: (pw: string) => boolean;
  required: boolean;
};

const REQUIREMENTS: Requirement[] = [
  { label: "Pelo menos 8 caracteres", test: (pw) => pw.length >= 8, required: true },
  { label: "Letra maiúscula (A-Z)", test: (pw) => /[A-Z]/.test(pw), required: true },
  { label: "Letra minúscula (a-z)", test: (pw) => /[a-z]/.test(pw), required: true },
  { label: "Número (0-9)", test: (pw) => /[0-9]/.test(pw), required: true },
  { label: "Símbolo (ex: !@#$%)", test: (pw) => /[^A-Za-z0-9]/.test(pw), required: true },
];

function getStrength(pw: string): { ok: boolean; label: string; color: string } {
  if (pw.length === 0) return { ok: false, label: "", color: "bg-muted" };
  const ok = REQUIREMENTS.filter((r) => r.required).every((r) => r.test(pw));
  if (ok) return { ok: true, label: "Requisitos atendidos", color: "bg-primary" };
  return { ok: false, label: "Não atende os requisitos", color: "bg-destructive" };
}


export function passwordMeetsRequirements(pw: string): boolean {
  return REQUIREMENTS.filter((r) => r.required).every((r) => r.test(pw));
}

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}

export function PasswordStrengthField({
  id = "password",
  value,
  onChange,
  placeholder = "Digite a senha (mínimo 8 caracteres)",
  autoComplete = "new-password",
}: Props) {
  const [show, setShow] = useState(false);
  const strength = useMemo(() => getStrength(value), [value]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          minLength={8}
          maxLength={128}
          className="pr-10"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {value.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-1.5 rounded-full transition-colors ${strength.color}`} />
            <span
              className={`text-xs font-medium min-w-[140px] text-right flex items-center justify-end gap-1 ${
                strength.ok ? "text-primary" : "text-destructive"
              }`}
            >
              {strength.ok && <Check className="w-3.5 h-3.5" />}
              {strength.label}
            </span>
          </div>

          <ul className="space-y-1 pt-1">
            {REQUIREMENTS.map((req) => {
              const ok = req.test(value);
              return (
                <li
                  key={req.label}
                  className={`flex items-center gap-2 text-xs transition-colors ${
                    ok
                      ? "text-primary"
                      : req.required
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {ok ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{req.label}</span>
                </li>
              );
            })}
          </ul>
          {strength.ok && (
            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
              Evite senhas comuns, nomes próprios ou combinações já vazadas; elas ainda podem ser bloqueadas por segurança.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
