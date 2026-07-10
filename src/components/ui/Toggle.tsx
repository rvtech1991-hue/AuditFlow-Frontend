type ToggleProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
};

export function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button className={`toggle ${checked ? "on" : ""}`} type="button" role="switch" aria-checked={checked} onClick={() => onChange?.(!checked)}>
      <span />
    </button>
  );
}
