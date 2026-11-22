import assert from "node:assert/strict";
import { test } from "node:test";
import { getApiErrorMessage, readJsonResponse } from "../src/api.js";

test("reads valid JSON and safely handles empty or non-JSON responses", async () => {
    assert.deepEqual(
        await readJsonResponse(new Response('{"message":"ok"}')),
        { message: "ok" }
    );
    assert.equal(await readJsonResponse(new Response("")), null);
    assert.equal(await readJsonResponse(new Response("<html>error</html>")), null);
});

test("provides a useful message when the API cannot be reached", () => {
    assert.match(
        getApiErrorMessage(new TypeError("Failed to fetch"), "Request failed."),
        /Could not connect to the PersonalStorage server/
    );
    assert.equal(
        getApiErrorMessage(new Error("Request rejected."), "Request failed."),
        "Request rejected."
    );
});
