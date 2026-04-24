/**
 * 0.5px horizontal rule with generous breathing room per spec.
 */

export default function Divider() {
  return (
    <hr
      className="my-10 border-0"
      style={{
        borderTop: "0.5px solid var(--color-border-tertiary)",
      }}
    />
  );
}
