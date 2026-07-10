import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type BaseProps = {
  label: string;
  as?: "input" | "textarea" | "select";
  options?: string[];
};

type FormFieldProps = BaseProps &
  (InputHTMLAttributes<HTMLInputElement> | TextareaHTMLAttributes<HTMLTextAreaElement> | SelectHTMLAttributes<HTMLSelectElement>);

export function FormField({ label, as = "input", options = [], ...props }: FormFieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      {as === "textarea" ? (
        <textarea {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : as === "select" ? (
        <select {...(props as SelectHTMLAttributes<HTMLSelectElement>)}>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input {...(props as InputHTMLAttributes<HTMLInputElement>)} />
      )}
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>;
}
