import { type LDBIssue } from "@/lib/luminardb";
import { useLuminarDB } from "@/providers/luminardb-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { Priority, useRegisterActions } from "kbar";
import { SquarePen, X } from "lucide-react";
import React from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Input,
  Modal,
  ModalOverlay,
  TextArea,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import { PriorityButton } from "./PriorityButton";
import { StatusButton } from "./StatusButton";
import { tinykeys } from "@/lib/tinykeys";

type FormState = {
  title: string;
  description: string;
  priority: LDBIssue["priority"];
  status: LDBIssue["status"];
};

const schema = z.object({
  title: z.string().min(1, "Title must be at least 1 character long"),
  description: z.string(),
  priority: z.enum(["NO_PRIORITY", "LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
});

export function CreateNewIssueModalButton() {
  const {
    register,
    control,
    formState: { errors, isSubmitting },
    handleSubmit,

    reset,
  } = useForm<FormState>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      priority: "NO_PRIORITY",
      status: "BACKLOG",
    },
  });

  const db = useLuminarDB();

  const [shouldShowModal, setShouldShowModal] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);

  async function onSubmit(data: z.infer<typeof schema>) {
    await db.mutate.createNewIssue({
      title: data.title,
      descriptionBody: data.description,
      priority: data.priority,
      status: data.status,
    });
    setShouldShowModal(false);
    reset();
  }

  useRegisterActions([
    {
      id: "create-new-issue",
      name: "Create new issue",
      shortcut: ["c"],
      perform() {
        setShouldShowModal(true);
      },
      priority: Priority.HIGH,
    },
  ]);

  React.useEffect(() => {
    if (!shouldShowModal) return;

    if (!containerRef.current) return;

    return tinykeys(containerRef.current, {
      "$mod+Enter": () => {
        void handleSubmit(onSubmit)();
      },
    }) as () => void;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShowModal]);

  return (
    <DialogTrigger>
      <TooltipTrigger delay={50} closeDelay={50}>
        <Button
          onPress={function () {
            setShouldShowModal(true);
          }}
          className={clsx(
            "flex items-center gap-2",
            "px-4 py-2",
            "rounded-md bg-zinc-800/70 hover:bg-zinc-800 focus:bg-zinc-800",
          )}
        >
          <SquarePen className="h-4 w-4" />
          Create new issue
        </Button>

        <Tooltip
          offset={10}
          placement="bottom"
          className={clsx(
            "bg-neutral-800/50 backdrop-blur",
            "rounded-md p-1 px-2",
            "border border-solid border-neutral-500/50",
            "text-neutral-300",
          )}
        >
          <div className="flex items-baseline">
            <p>Create new issue</p>
            <span className="ml-2">
              <kbd className="rounded-md bg-zinc-800/90 p-1 px-2 text-xs">
                c
              </kbd>
            </span>
          </div>
        </Tooltip>
      </TooltipTrigger>
      <ModalOverlay
        isOpen={shouldShowModal}
        onOpenChange={function (isOpen) {
          if (!isOpen) {
            reset();
          }
          setShouldShowModal(isOpen);
        }}
        className={clsx(
          "absolute left-0 top-0  h-screen w-screen bg-neutral-950/50 backdrop-blur-sm",
          "px-4 py-4 md:px-8 md:py-8",
        )}
      >
        <Modal className={clsx("mx-auto max-w-screen-md")} ref={containerRef}>
          <Dialog
            className={clsx(
              "border-collapse rounded-md border border-solid border-gray-300/40",
              "bg-zinc-900/85 shadow shadow-neutral-600/90  backdrop-blur-sm",
              "outline-none",
              "min-w-screen-md  max-w-screen-md",
            )}
            aria-label={`Create a new issue`}
          >
            {({ close }) => {
              return (
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <Heading
                      className={clsx("text-sm text-neutral-300")}
                      slot="title"
                    >
                      New issue
                    </Heading>

                    <Button onPress={close}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <hr className="my-4 border-neutral-700" />
                  <form className="" onSubmit={handleSubmit(onSubmit)}>
                    <div className="flex flex-col gap-4">
                      <Input
                        autoFocus
                        placeholder="Issue title"
                        className={clsx(
                          "text-md w-full bg-transparent outline-none",
                        )}
                        {...register("title")}
                      />
                      <TextArea
                        rows={4}
                        placeholder="Add description..."
                        className="w-full resize-none bg-transparent outline-none"
                        {...register("description")}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Controller
                        control={control}
                        name="priority"
                        render={function ({ field: { onChange, value } }) {
                          return (
                            <PriorityButton
                              size="sm"
                              showLabel
                              priority={value}
                              onPriorityChange={onChange}
                            />
                          );
                        }}
                      />
                      <Controller
                        control={control}
                        name="status"
                        render={function ({ field: { onChange, value } }) {
                          return (
                            <StatusButton
                              size="sm"
                              showLabel
                              status={value}
                              onSelectedStatusChange={onChange}
                            />
                          );
                        }}
                      />
                    </div>
                    <hr className="my-4 border-neutral-700" />
                    <div className="flex items-center justify-between">
                      {Object.keys(errors).length > 0 ? (
                        <div className="flex grow items-center">
                          <ul className="text-red-500">
                            {Object.entries(errors).map(([key, value]) => {
                              return (
                                <li className="text-sm" key={key}>
                                  {value.message}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                      <div className="flex grow items-center justify-end gap-4 text-sm">
                        <Button
                          className={clsx(
                            "text-neutral-300 hover:text-neutral-200",
                            "rounded-md p-2",
                          )}
                        >
                          Cancel
                        </Button>
                        <Button
                          className={clsx(
                            "text-neutral-300 hover:text-neutral-200",
                            "border border-solid border-neutral-700",
                            "rounded-md p-2",
                          )}
                          type="submit"
                          isDisabled={isSubmitting}
                        >
                          Create issue
                        </Button>
                      </div>
                    </div>
                  </form>
                </div>
              );
            }}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
