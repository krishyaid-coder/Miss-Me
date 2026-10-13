import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { healthFromHits, recallHit, scoreCheck } from "./score.js";
import type { Anchor } from "./types.js";

describe("recallHit", () => {
  it("treats empty recall as a miss", () => {
    assert.equal(recallHit("use FastAPI and Postgres", ""), false);
    assert.equal(recallHit("use FastAPI and Postgres", null), false);
  });

  it("hits when the stored fact is restated", () => {
    assert.equal(
      recallHit("The API is FastAPI with Postgres", "we are on fastapi and postgres"),
      true,
    );
  });

  it("misses a confident but wrong restatement", () => {
    assert.equal(
      recallHit("The API is FastAPI with Postgres", "the frontend is Next.js with Mongo"),
      false,
    );
  });
});

describe("healthFromHits", () => {
  it("maps all / some / none", () => {
    assert.equal(healthFromHits([]), "unknown");
    assert.equal(healthFromHits([true, true]), "green");
    assert.equal(healthFromHits([true, false]), "degrading");
    assert.equal(healthFromHits([false, false]), "lost");
  });
});

describe("scoreCheck", () => {
  const anchors: Anchor[] = [
    {
      id: "a1",
      label: "stack",
      fact: "FastAPI plus Postgres",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "a2",
      label: "audience",
      fact: "Non-technical daily chat users",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("scores mixed recall as degrading", () => {
    const result = scoreCheck(anchors, [
      { id: "a1", recalled: "fastapi plus postgres" },
      { id: "a2", recalled: "" },
    ]);
    assert.equal(result.health, "degrading");
    assert.equal(result.recalls[0]?.hit, true);
    assert.equal(result.recalls[1]?.hit, false);
  });

  it("treats a missing id as a miss", () => {
    const result = scoreCheck(anchors, [{ id: "a1", recalled: "fastapi plus postgres" }]);
    assert.equal(result.health, "degrading");
  });
});
