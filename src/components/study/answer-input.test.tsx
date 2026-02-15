import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnswerInput } from "./answer-input";
import { AnswerType } from "@/lib/types";

describe("AnswerInput", () => {
  describe("Text-based input (INTEGER, DECIMAL, TEXT, FRACTION)", () => {
    it("should render text input for INTEGER type", () => {
      const onSubmit = vi.fn();
      render(<AnswerInput answerType={AnswerType.INTEGER} onSubmit={onSubmit} />);

      expect(screen.getByPlaceholderText(/integer/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
    });

    it("should render text input for DECIMAL type", () => {
      const onSubmit = vi.fn();
      render(<AnswerInput answerType={AnswerType.DECIMAL} onSubmit={onSubmit} />);

      expect(screen.getByPlaceholderText(/number/i)).toBeInTheDocument();
    });

    it("should render text input for TEXT type", () => {
      const onSubmit = vi.fn();
      render(<AnswerInput answerType={AnswerType.TEXT} onSubmit={onSubmit} />);

      expect(screen.getByPlaceholderText(/answer/i)).toBeInTheDocument();
    });

    it("should render text input for FRACTION type", () => {
      const onSubmit = vi.fn();
      render(<AnswerInput answerType={AnswerType.FRACTION} onSubmit={onSubmit} />);

      expect(screen.getByPlaceholderText(/fraction/i)).toBeInTheDocument();
    });

    it("should call onSubmit with trimmed answer", () => {
      const onSubmit = vi.fn();
      render(<AnswerInput answerType={AnswerType.INTEGER} onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText(/integer/i);

      fireEvent.change(input, { target: { value: "  42  " } });
      fireEvent.submit(input.closest("form")!);

      expect(onSubmit).toHaveBeenCalledWith("42");
    });

    it("should not submit empty answer", () => {
      const onSubmit = vi.fn();
      render(<AnswerInput answerType={AnswerType.TEXT} onSubmit={onSubmit} />);

      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).toBeDisabled();

      fireEvent.click(submitButton);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("should disable input when disabled prop is true", () => {
      const onSubmit = vi.fn();
      render(
        <AnswerInput answerType={AnswerType.TEXT} onSubmit={onSubmit} disabled />
      );

      const input = screen.getByPlaceholderText(/answer/i);
      expect(input).toBeDisabled();
    });
  });

  describe("Choice-based input", () => {
    const choices = ["Option A", "Option B", "Option C"];

    it("should render choice buttons", () => {
      const onSubmit = vi.fn();
      render(
        <AnswerInput
          answerType={AnswerType.CHOICE}
          choices={choices}
          onSubmit={onSubmit}
        />
      );

      expect(screen.getByText(/Option A/)).toBeInTheDocument();
      expect(screen.getByText(/Option B/)).toBeInTheDocument();
      expect(screen.getByText(/Option C/)).toBeInTheDocument();
    });

    it("should show letter prefixes", () => {
      const onSubmit = vi.fn();
      render(
        <AnswerInput
          answerType={AnswerType.CHOICE}
          choices={choices}
          onSubmit={onSubmit}
        />
      );

      expect(screen.getByText("A.")).toBeInTheDocument();
      expect(screen.getByText("B.")).toBeInTheDocument();
      expect(screen.getByText("C.")).toBeInTheDocument();
    });

    it("should call onSubmit when choice is clicked", () => {
      const onSubmit = vi.fn();
      render(
        <AnswerInput
          answerType={AnswerType.CHOICE}
          choices={choices}
          onSubmit={onSubmit}
        />
      );

      fireEvent.click(screen.getByText(/Option B/));
      expect(onSubmit).toHaveBeenCalledWith("Option B");
    });

    it("should disable choice buttons when disabled", () => {
      const onSubmit = vi.fn();
      render(
        <AnswerInput
          answerType={AnswerType.CHOICE}
          choices={choices}
          onSubmit={onSubmit}
          disabled
        />
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });
});
