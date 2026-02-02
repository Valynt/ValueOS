import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, it, expect } from "vitest";
import { useEffect } from "react";
import { Form, FormInput, FormTextarea, FormSelect } from "./FormSystem";

const TestForm = ({ defaultValues = {} }) => {
  const form = useForm({ defaultValues });
  const onSubmit = () => {};

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormInput
        name="testInput"
        form={form}
        label="Test Input"
        helpText="This is input help text"
      />
      <FormTextarea
        name="testTextarea"
        form={form}
        label="Test Textarea"
        helpText="This is textarea help text"
      />
      <FormSelect
        name="testSelect"
        form={form}
        label="Test Select"
        options={[{ value: "opt1", label: "Option 1" }]}
        helpText="This is select help text"
      />
    </Form>
  );
};

const ErrorForm = () => {
  const form = useForm({
    defaultValues: {
      errorInput: "",
    },
    mode: "onChange",
  });

  // Manually set an error for testing
  // Use useEffect to avoid "Too many re-renders"
  useEffect(() => {
    form.setError("errorInput", {
      type: "manual",
      message: "This is an error message"
    });
  }, [form]);

  return (
    <Form form={form} onSubmit={() => {}}>
      <FormInput
        name="errorInput"
        form={form}
        label="Error Input"
      />
    </Form>
  );
};

describe("FormSystem Accessibility", () => {
  it("associates labels with inputs using htmlFor and id", () => {
    render(<TestForm />);

    // These should work if htmlFor and id are correctly set
    expect(screen.getByLabelText("Test Input")).toBeInTheDocument();
    expect(screen.getByLabelText("Test Textarea")).toBeInTheDocument();
    expect(screen.getByLabelText("Test Select")).toBeInTheDocument();
  });

  it("links help text via aria-describedby", () => {
    render(<TestForm />);

    const input = screen.getByLabelText("Test Input");
    const textarea = screen.getByLabelText("Test Textarea");
    const select = screen.getByLabelText("Test Select");

    // Check if aria-describedby points to an element with the help text
    const inputHelpId = input.getAttribute("aria-describedby");
    const textareaHelpId = textarea.getAttribute("aria-describedby");
    const selectHelpId = select.getAttribute("aria-describedby");

    expect(inputHelpId).toBeTruthy();
    expect(document.getElementById(inputHelpId!)?.textContent).toBe("This is input help text");

    expect(textareaHelpId).toBeTruthy();
    expect(document.getElementById(textareaHelpId!)?.textContent).toBe("This is textarea help text");

    expect(selectHelpId).toBeTruthy();
    expect(document.getElementById(selectHelpId!)?.textContent).toBe("This is select help text");
  });

  it("links error message via aria-describedby", () => {
    render(<ErrorForm />);

    const input = screen.getByLabelText("Error Input");
    const errorId = input.getAttribute("aria-describedby");

    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)?.textContent).toBe("This is an error message");
  });
});
