import { FloppyDiskIcon, GiftIcon, TrashIcon } from "@phosphor-icons/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export type GiftFeedback = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

// Shared Gift inventory Product shelf used by the Gift studio and the Gift
// lab. Both pages read and write the same giftProductPresets data, so a
// product saved on one page shows up on the other. Each save is verified
// against Fourthwall and carries a live name plus thumbnail preview.
export function GiftProductShelf({
  activeProductId,
  onUse,
  onFeedback,
}: {
  activeProductId: string;
  onUse: (productId: string) => void;
  onFeedback: (feedback: GiftFeedback) => void;
}) {
  const productPresets = useQuery(api.gifts.listProductPresetsAdmin, {});
  const saveProductPreset = useAction(api.giftActions.saveProductPreset);
  const deleteProductPreset = useMutation(api.gifts.deleteProductPreset);
  const [shelfLabel, setShelfLabel] = useState("");
  const [shelfProductId, setShelfProductId] = useState("");
  const [saving, setSaving] = useState(false);

  async function savePreset() {
    setSaving(true);
    onFeedback(null);
    try {
      const result = await saveProductPreset({
        label: shelfLabel,
        fourthwallProductId: shelfProductId,
      });
      setShelfLabel("");
      setShelfProductId("");
      if (result.previewWarning) {
        onFeedback({
          tone: "info",
          message: `Saved the product, but the Fourthwall preview could not load: ${result.previewWarning}`,
        });
      } else {
        onFeedback({
          tone: "success",
          message: `Verified with Fourthwall and saved “${result.productName ?? "product"}” to the shelf.`,
        });
      }
    } catch (error) {
      onFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not save the product." });
    } finally {
      setSaving(false);
    }
  }

  async function removePreset(presetId: Id<"giftProductPresets">, label: string) {
    onFeedback(null);
    try {
      await deleteProductPreset({ presetId });
      onFeedback({ tone: "success", message: `Removed “${label}” from saved products.` });
    } catch (error) {
      onFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not remove the product." });
    }
  }

  return (
    <section className="gift-product-shelf" aria-labelledby="gift-shelf-title">
      <div>
        <p className="section-kicker">Gift inventory</p>
        <h2 id="gift-shelf-title">Product shelf</h2>
        <p>
          Save Fourthwall products with a short label ahead of time. Each save
          checks the ID with Fourthwall and pulls the product name and a
          preview image, so the form is one click instead of a paste.
        </p>
      </div>
      <div className="gift-shelf-add">
        <input
          value={shelfLabel}
          onChange={(event) => setShelfLabel(event.target.value)}
          placeholder="Label, like Racing tee"
          maxLength={60}
          aria-label="Label for the saved Fourthwall product"
        />
        <input
          value={shelfProductId}
          onChange={(event) => setShelfProductId(event.target.value)}
          placeholder="Fourthwall product ID"
          aria-label="Fourthwall product ID to save"
          title="Copy the product ID from the Fourthwall dashboard"
        />
        <button
          type="button"
          className="secondary-button"
          disabled={saving || !shelfLabel.trim() || !shelfProductId.trim()}
          title="Verify this product with Fourthwall and save it for one-click reuse"
          onClick={() => void savePreset()}
        >
          <FloppyDiskIcon aria-hidden="true" /> {saving ? "Checking Fourthwall" : "Save product"}
        </button>
      </div>
      {productPresets === undefined ? (
        <span className="gift-empty">Loading saved products…</span>
      ) : productPresets.length === 0 ? (
        <span className="gift-empty">No saved products yet. Add your first one above.</span>
      ) : (
        <div className="gift-shelf-grid" role="group" aria-label="Saved Fourthwall products">
          {productPresets.map((preset) => (
            <article
              key={preset._id}
              className={`gift-shelf-card${preset.fourthwallProductId === activeProductId ? " is-active" : ""}`}
            >
              {preset.thumbnailUrl ? (
                <img src={preset.thumbnailUrl} alt="" loading="lazy" />
              ) : (
                <span className="gift-shelf-placeholder" aria-hidden="true">
                  <GiftIcon />
                </span>
              )}
              <div className="gift-shelf-copy">
                <strong>{preset.label}</strong>
                {preset.productName ? <small>{preset.productName}</small> : null}
                <code title={preset.fourthwallProductId}>
                  {preset.fourthwallProductId.length > 14
                    ? `${preset.fourthwallProductId.slice(0, 8)}…${preset.fourthwallProductId.slice(-4)}`
                    : preset.fourthwallProductId}
                </code>
              </div>
              <div className="gift-shelf-actions">
                <button
                  type="button"
                  className="secondary-button"
                  title={`Fill the form with product ID ${preset.fourthwallProductId}`}
                  onClick={() => onUse(preset.fourthwallProductId)}
                >
                  Use
                </button>
                <button
                  type="button"
                  className="gift-preset-remove"
                  aria-label={`Remove saved product ${preset.label}`}
                  title={`Remove “${preset.label}” from the shelf`}
                  onClick={() => void removePreset(preset._id, preset.label)}
                >
                  <TrashIcon aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
