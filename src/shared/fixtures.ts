import type { ReviewDocument } from "./blocks";

export const credentialAppSeedReview: ReviewDocument = {
  version: 1,
  blocks: [
    {
      id: "summary",
      type: "rich-text",
      summary: "Outcome",
      data: {
        markdown:
          "## Outcome\nThis seeded recap is based on `credential-app` branch `codex/property-qr-tests` against `master`. The change expands QR/property coverage, adds Playwright harness checks, and tightens issuer/holder flow tests around credential acceptance.\n\nValidation reported by the fixture: `pnpm check`, unit tests, worker tests, and build still need to be run by the publishing agent before a production review is approved.",
      },
    },
    {
      id: "qr-contract",
      type: "api-endpoint",
      summary: "QR credential-offer contract",
      data: {
        path: "QR: credential-offer payload",
        method: "encode/decode",
        change: "modified",
        params: [
          {
            name: "issuer",
            type: "did:key | did:web",
            change: "modified",
            note: "Property tests now cover generated issuer identifiers.",
          },
          {
            name: "credentialOffer",
            type: "object",
            change: "modified",
            note: "Examples are checked across generated payloads rather than one fixture.",
          },
        ],
        request: {
          issuer: "did:key:z6Mk...",
          credentialOffer: { type: "BadgeCredential", nonce: "generated" },
        },
        responses: [{ ok: true, roundTrip: "payload survives encode/decode" }],
      },
    },
    {
      id: "issuer-data-model",
      type: "data-model",
      summary: "Issuer activity state",
      data: {
        entities: [
          {
            name: "IssuerActivity",
            change: "modified",
            fields: [
              {
                name: "qrPayload",
                type: "CredentialOfferPayload",
                change: "modified",
                note: "Tests now exercise the payload as the source of the holder acceptance flow.",
              },
              {
                name: "status",
                type: "created | shared | accepted",
                note: "Regression tests cover the transition after holder acceptance.",
              },
            ],
          },
        ],
        relations: [
          "GiveBadgeFlow creates IssuerActivity",
          "EarnBadgeFlow consumes QR payload",
        ],
      },
    },
    {
      id: "footprint",
      type: "file-tree",
      summary: "Changed files",
      data: {
        entries: [
          {
            path: "src/credential/domain/qrPayloads.property.test.ts",
            change: "added",
            additions: 143,
            note: "Generated round-trip coverage for QR payload schemas.",
          },
          {
            path: "e2e/credentials/credential-acceptance.spec.ts",
            change: "added",
            additions: 139,
            note: "Browser-level issuer to holder credential acceptance path.",
          },
          {
            path: "src/features/issuer/GiveBadgeFlow.tsx",
            change: "modified",
            additions: 101,
            deletions: 0,
            note: "Flow changes covered by expanded tests.",
          },
          {
            path: "src/features/holder/EarnBadgeFlow.tsx",
            change: "modified",
            additions: 72,
            note: "Holder acceptance flow updates.",
          },
        ],
      },
    },
    {
      id: "qr-property-test",
      type: "annotated-code",
      summary: "New QR property test",
      data: {
        filename: "src/credential/domain/qrPayloads.property.test.ts",
        language: "ts",
        startLine: 1,
        code: `describe("credential offer QR payloads", () => {
  it("round-trips generated offers", () => {
    for (const offer of generatedCredentialOffers()) {
      const encoded = encodeCredentialOfferQrPayload(offer);
      expect(decodeCredentialOfferQrPayload(encoded)).toEqual(offer);
    }
  });
});`,
        annotations: [
          {
            side: "after",
            lines: "3-5",
            label: "contract coverage",
            note: "The fixture highlights the generated round-trip check as the key review point.",
          },
        ],
      },
    },
    {
      id: "issuer-flow-diff",
      type: "diff",
      summary: "Issuer flow wiring",
      data: {
        filename: "src/features/issuer/GiveBadgeFlow.tsx",
        language: "tsx",
        mode: "split",
        before: `const onShare = () => {
  setStep("share");
  setQrPayload(createCredentialOffer(input));
};`,
        after: `const onShare = () => {
  const offer = createCredentialOffer(input);
  issuerActivity.recordSharedOffer(offer);
  setStep("share");
  setQrPayload(offer);
};`,
        annotations: [
          {
            side: "after",
            lines: "2-3",
            label: "state coupling",
            note: "Review whether recording the offer before rendering the QR can leave stale activity on later failures.",
          },
        ],
      },
    },
    {
      id: "flow-diagram",
      type: "mermaid",
      summary: "Credential acceptance path",
      data: {
        caption: "Seeded M2 flow from the credential-app branch.",
        source: `sequenceDiagram
  participant Issuer
  participant QR
  participant Holder
  Issuer->>QR: create credential offer
  Holder->>QR: scan payload
  Holder->>Issuer: accept credential
  Issuer->>Issuer: record accepted activity`,
      },
    },
    {
      id: "review-questions",
      type: "question-form",
      summary: "Open review questions",
      data: {
        questions: [
          {
            id: "q-validation-gate",
            prompt:
              "Were the credential-app validation gates run on this branch?",
            mode: "single",
            options: ["yes", "no", "partial"],
          },
          {
            id: "q-stale-activity",
            prompt:
              "Should issuer activity be rolled back if QR rendering fails?",
            mode: "freeform",
          },
        ],
      },
    },
  ],
};
