"use client";

import { GroupIconPicker } from "@/components/GroupIconPicker";
import { type GroupIconId, isGroupIconId } from "@/lib/groupIcons";
import { useT } from "@/lib/i18n";

interface Props {
  value: GroupIconId;
  onChange: (icon: GroupIconId) => void;
  onSave: () => void;
  saving?: boolean;
  dirty?: boolean;
}

export function GroupIconSettings({ value, onChange, onSave, saving, dirty }: Props) {
  const t = useT();

  return (
    <div className="mt-5 border-t border-white/20 pt-5">
      <GroupIconPicker value={value} onChange={onChange} variant="dark" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="rounded-full bg-gold-400 px-5 py-2 text-sm font-bold text-night-900 shadow transition hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? t("loading") : t("groupIconSave")}
        </button>
        {!dirty && (
          <p className="text-xs font-medium text-white/70">{t("groupIconCurrentHint")}</p>
        )}
      </div>
    </div>
  );
}

export function parseGroupIcon(value: string | null | undefined): GroupIconId {
  if (value && isGroupIconId(value)) return value;
  return "club_friends";
}
