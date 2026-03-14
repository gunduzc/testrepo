/**
 * CardService - Card CRUD operations with sandbox validation
 */

import prisma from "@/lib/prisma";
import { sandboxService } from "./sandbox.service";
import {
  CreateCardDTO,
  UpdateCardDTO,
  CardOutput,
  SandboxResult,
  AuthoringHistoryEntry,
} from "@/lib/types";

export class CardService {
  /**
   * Creates a new card with sandbox validation
   */
  async create(
    data: CreateCardDTO,
    authorId: string
  ): Promise<{ id: string; name: string }> {
    // Validate source by executing it
    const testResult = await sandboxService.executeCard(data.functionSource);

    if (!testResult.success) {
      throw new Error(`Invalid card function: ${testResult.error.message}`);
    }

    // Create card in transaction
    const card = await prisma.$transaction(async (tx) => {
      const card = await tx.card.create({
        data: {
          functionSource: data.functionSource,
          name: data.name,
          description: data.description,
          answerType: data.answerType,
          learningSteps: data.learningSteps ?? 5,
          relearningSteps: data.relearningSteps ?? 3,
          reviewSteps: data.reviewSteps ?? 1,
          tags: JSON.stringify(data.tags ?? []),
          authorId,
        },
      });

      // Create authoring history if provided (for LLM-generated cards)
      if (data.authoringHistory && data.authoringHistory.length > 0) {
        await tx.cardAuthoringHistory.create({
          data: {
            cardId: card.id,
            entries: JSON.stringify(data.authoringHistory),
          },
        });
      }

      // Add to subject if specified
      if (data.subjectId) {
        // Get max position in subject
        const maxPos = await tx.cardSubject.findFirst({
          where: { subjectId: data.subjectId },
          orderBy: { position: "desc" },
          select: { position: true },
        });

        const position = data.position ?? (maxPos ? maxPos.position + 1 : 0);

        await tx.cardSubject.create({
          data: {
            cardId: card.id,
            subjectId: data.subjectId,
            position,
          },
        });
      }

      return card;
    });

    return { id: card.id, name: card.name };
  }

  /**
   * Updates an existing card
   */
  async update(
    cardId: string,
    data: UpdateCardDTO,
    userId: string
  ): Promise<{ id: string; name: string }> {
    // Check ownership
    const existing = await prisma.card.findUnique({
      where: { id: cardId },
      select: { authorId: true },
    });

    if (!existing) {
      throw new Error("Card not found");
    }

    // Check if user is author or admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (existing.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to update this card");
    }

    // Validate new source if provided
    if (data.functionSource) {
      const testResult = await sandboxService.executeCard(data.functionSource);
      if (!testResult.success) {
        throw new Error(`Invalid card function: ${testResult.error.message}`);
      }
    }

    const card = await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(data.functionSource && { functionSource: data.functionSource }),
        ...(data.name && { name: data.name }),
        ...(data.description && { description: data.description }),
        ...(data.answerType && { answerType: data.answerType }),
        ...(data.learningSteps !== undefined && { learningSteps: data.learningSteps }),
        ...(data.relearningSteps !== undefined && { relearningSteps: data.relearningSteps }),
        ...(data.reviewSteps !== undefined && { reviewSteps: data.reviewSteps }),
        ...(data.tags && { tags: JSON.stringify(data.tags) }),
      },
    });

    return { id: card.id, name: card.name };
  }

  /**
   * Deletes a card (cascades to related records)
   */
  async delete(cardId: string, userId: string): Promise<void> {
    const existing = await prisma.card.findUnique({
      where: { id: cardId },
      select: { authorId: true },
    });

    if (!existing) {
      throw new Error("Card not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (existing.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to delete this card");
    }

    await prisma.card.delete({ where: { id: cardId } });
  }

  /**
   * Gets a card by ID
   */
  async getById(cardId: string): Promise<{
    id: string;
    name: string;
    description: string;
    functionSource: string;
    answerType: string;
    learningSteps: number;
    relearningSteps: number;
    reviewSteps: number;
    tags: string[];
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card) return null;

    return {
      ...card,
      tags: JSON.parse(card.tags) as string[],
    };
  }

  /**
   * Tests a card function without saving
   * Returns multiple sample outputs for preview
   */
  async testFunction(
    source: string,
    count: number = 10
  ): Promise<SandboxResult[]> {
    return sandboxService.testCard(source, count);
  }

  /**
   * Gets cards by author
   */
  async getByAuthor(
    authorId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ cards: { id: string; name: string; description: string; answerType: string }[]; total: number }> {
    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where: { authorId },
        select: {
          id: true,
          name: true,
          description: true,
          answerType: true,
        },
        take: options?.limit,
        skip: options?.offset,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.card.count({ where: { authorId } }),
    ]);

    return { cards, total };
  }

  /**
   * Searches cards by tags or name
   */
  async search(
    query: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ cards: { id: string; name: string; description: string; authorId: string }[]; total: number }> {
    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
            { tags: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          authorId: true,
        },
        take: options?.limit,
        skip: options?.offset,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.card.count({
        where: {
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
            { tags: { contains: query } },
          ],
        },
      }),
    ]);

    return { cards, total };
  }
}

// Singleton instance
export const cardService = new CardService();
