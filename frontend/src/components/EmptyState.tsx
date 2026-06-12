import Link from "next/link";

interface Props {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export function EmptyState({ icon = "⚽", title, description, action }: Props) {
  return (
    <div className="empty-state">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-royal-100 to-pitch-100 text-4xl shadow-inner" aria-hidden>
        {icon}
      </span>
      <h3 className="font-display text-lg font-extrabold text-night-900">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-gray-600">{description}</p>
      {action && (
        <Link href={action.href} className="btn-primary mt-6 text-sm">
          {action.label}
        </Link>
      )}
    </div>
  );
}
