"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface CardData {
  id: string;
  name: string;
  description: string;
  answerType: string;
}

interface CardPickerProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string;
  existingCardIds: string[];
  onCardsAdded: () => void;
}

export function CardPicker({ isOpen, onClose, subjectId, existingCardIds, onCardsAdded }: CardPickerProps) {
  const [search, setSearch] = useState("");
  const [cards, setCards] = useState<CardData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCards();
    }
  }, [isOpen, search]);

  const fetchCards = async () => {
    setIsLoading(true);
    try {
      const url = search
        ? `/api/cards?search=${encodeURIComponent(search)}&limit=50`
        : `/api/cards?limit=50`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCards(data.data.cards || []);
      }
    } catch (error) {
      console.error("Failed to fetch cards:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCard = (cardId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedIds(newSelected);
  };

  const handleAddCards = async () => {
    if (selectedIds.size === 0) return;

    setIsAdding(true);
    try {
      for (const cardId of selectedIds) {
        await fetch(`/api/subjects/${subjectId}/cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId }),
        });
      }
      setSelectedIds(new Set());
      onCardsAdded();
      onClose();
    } catch (error) {
      console.error("Failed to add cards:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const availableCards = cards.filter((c) => !existingCardIds.includes(c.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Cards to Subject" size="lg">
      <div className="space-y-4">
        <Input
          placeholder="Search cards by name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          ) : availableCards.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              {search ? "No cards found" : "No available cards"}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {availableCards.map((card) => (
                <label
                  key={card.id}
                  className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.has(card.id)}
                    onChange={() => toggleCard(card.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {card.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {card.description || "No description"}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {card.answerType}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddCards}
            disabled={selectedIds.size === 0 || isAdding}
          >
            {isAdding ? "Adding..." : `Add ${selectedIds.size} Card${selectedIds.size !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
