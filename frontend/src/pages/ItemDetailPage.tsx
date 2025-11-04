import { useParams } from 'react-router-dom';

/**
 * ItemDetailPage - Detailed view of a single item
 * 
 * Phase 1B Placeholder: Will show full item details, purchase history, predictions
 */
export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1 className="text-3xl font-bold text-neutral-900 mb-6">Item Details</h1>
      <p className="text-neutral-600">
        Viewing item: {id} (Phase 1B Placeholder)
      </p>
    </div>
  );
}
