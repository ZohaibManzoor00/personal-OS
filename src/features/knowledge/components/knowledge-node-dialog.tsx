"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Node as KnowledgeNode } from "@/generated/prisma/client";
import { useCreateNode, useUpdateNode } from "../hooks/use-knowledge";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
});
type FormValues = z.infer<typeof schema>;

type CreateProps = {
  mode: "create";
  type: "SPACE" | "PAGE";
  parentId: string | null;
  node?: never;
};
type RenameProps = {
  mode: "rename";
  node: KnowledgeNode;
  type?: never;
  parentId?: never;
};

type Props = (CreateProps | RenameProps) & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (node: KnowledgeNode) => void;
};

export const KnowledgeNodeDialog = (props: Props) => {
  const { open, onOpenChange, mode, onCreated } = props;

  const createNode = useCreateNode();
  const updateNode = useUpdateNode();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: mode === "rename" ? props.node.title : "" },
  });

  useEffect(() => {
    if (open) form.reset({ title: mode === "rename" ? props.node.title : "" });
  }, [open, mode, props, form]);

  const isPending = createNode.isPending || updateNode.isPending;

  const label = mode === "rename" ? "Rename" : props.type === "SPACE" ? "New space" : "New page";

  const onSubmit = (values: FormValues) => {
    if (mode === "create") {
      createNode.mutate(
        { parentId: props.parentId, type: props.type, title: values.title },
        {
          onSuccess: (node) => {
            onOpenChange(false);
            onCreated?.(node);
          },
        },
      );
      return;
    }

    updateNode.mutate({ id: props.node.id, title: values.title }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {mode === "rename"
              ? "Give this item a new name."
              : props.type === "SPACE"
                ? "Spaces group pages and other spaces together."
                : "Pages hold your notes and content."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      autoFocus
                      placeholder={mode === "create" && props.type === "SPACE" ? "Computer Science" : "Untitled"}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {mode === "rename" ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
