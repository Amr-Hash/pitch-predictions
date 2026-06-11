"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api, Group, unwrapList } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function GroupsContent() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinCode, setJoinCode] = useState(searchParams.get("code") || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const loadGroups = () => {
    if (!token) return;
    api.getGroups(token).then((data) => setGroups(unwrapList(data)));
  };

  useEffect(loadGroups, [token]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    try {
      await api.createGroup(token, { name, description });
      setName("");
      setDescription("");
      setSuccess("Group created!");
      loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    try {
      await api.joinGroup(token, joinCode.toUpperCase());
      setJoinCode("");
      setSuccess("Joined group!");
      loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  if (authLoading || !user) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Prediction Groups</h1>
      <p className="mb-6 text-gray-600">
        Create or join a group to compete with friends.{" "}
        <Link href="/world-cup-groups" className="font-medium text-pitch-600 hover:underline">
          View World Cup 2026 groups & teams →
        </Link>
      </p>
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-green-700">{success}</div>}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Create Group</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              className="input"
              placeholder="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <textarea
              className="input"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <button type="submit" className="btn-primary">Create</button>
          </form>
        </div>
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Join Group</h2>
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              className="input"
              placeholder="Invitation code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary">Join</button>
          </form>
        </div>
      </div>

      <h2 className="mb-4 text-xl font-semibold">Your Groups</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.id} className="card">
            <h3 className="font-semibold">{g.name}</h3>
            {g.description && <p className="mt-1 text-sm text-gray-600">{g.description}</p>}
            <p className="mt-2 text-sm">
              <span className="text-gray-500">Invite code:</span>{" "}
              <code className="rounded bg-gray-100 px-2 py-0.5">{g.invite_code}</code>
            </p>
            <p className="text-sm text-gray-500">{g.member_count} members</p>
            {g.is_admin && (
              <span className="mt-2 inline-block rounded bg-gold-400/20 px-2 py-0.5 text-xs font-medium text-gold-500">
                Admin
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
