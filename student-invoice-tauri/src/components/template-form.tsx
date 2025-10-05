import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { InvoiceTemplate } from "../types";

const templateSchema = z.object({
  recipient: z.string().min(1, "Recipient name is required"),
  cost: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Cost must be a positive number",
  }),
  instrument: z.string().min(1, "Instrument is required"),
  day: z.string().min(1, "Day is required"),
  students: z.string().min(1, "Student name is required"),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: InvoiceTemplate | null;
  onSubmit: (data: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const instruments = [
  "piano",
  "drum",
  "guitar",
  "vocal",
  "music",
  "singing",
  "bass guitar",
  "classical guitar"
];

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

export function TemplateForm({ open, onOpenChange, template, onSubmit }: TemplateFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    watch
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: template ? {
      recipient: template.recipient,
      cost: template.cost.toString(),
      instrument: template.instrument,
      day: template.day,
      students: template.students,
    } : {
      recipient: "",
      cost: "",
      instrument: "",
      day: "",
      students: "",
    }
  });

  React.useEffect(() => {
    if (template) {
      reset({
        recipient: template.recipient,
        cost: template.cost.toString(),
        instrument: template.instrument,
        day: template.day,
        students: template.students,
      });
    } else {
      reset({
        recipient: "",
        cost: "",
        instrument: "",
        day: "",
        students: "",
      });
    }
  }, [template, reset]);

  const handleFormSubmit = (data: TemplateFormData) => {
    onSubmit({
      recipient: data.recipient,
      cost: parseFloat(data.cost),
      instrument: data.instrument,
      day: data.day,
      students: data.students,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template" : "Create New Template"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? "Update the template details below."
              : "Fill in the details to create a new invoice template."
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Name</Label>
            <Input
              id="recipient"
              placeholder="e.g. John Doe"
              {...register("recipient")}
            />
            {errors.recipient && (
              <p className="text-sm text-red-600">{errors.recipient.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Lesson Cost (£)</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              placeholder="e.g. 25.00"
              {...register("cost")}
            />
            {errors.cost && (
              <p className="text-sm text-red-600">{errors.cost.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instrument">Instrument</Label>
            <Select
              value={watch("instrument")}
              onValueChange={(value) => setValue("instrument", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an instrument" />
              </SelectTrigger>
              <SelectContent>
                {instruments.map((instrument) => (
                  <SelectItem key={instrument} value={instrument}>
                    {instrument.charAt(0).toUpperCase() + instrument.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.instrument && (
              <p className="text-sm text-red-600">{errors.instrument.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="day">Lesson Day</Label>
            <Select
              value={watch("day")}
              onValueChange={(value) => setValue("day", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a day" />
              </SelectTrigger>
              <SelectContent>
                {daysOfWeek.map((day) => (
                  <SelectItem key={day} value={day}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.day && (
              <p className="text-sm text-red-600">{errors.day.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="students">Student Name(s)</Label>
            <Input
              id="students"
              placeholder="e.g. Emma Doe"
              {...register("students")}
            />
            {errors.students && (
              <p className="text-sm text-red-600">{errors.students.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {template ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
