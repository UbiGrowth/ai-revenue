import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Mail, Share2, Video, Phone, Calendar as CalendarIcon, Clock, Send, Trash2 } from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { Json } from "@/integrations/supabase/types";

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  channel: string | null;
  scheduled_at: string;
  published_at: string | null;
  status: string;
  asset_id: string | null;
  content: Json;
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  social: <Share2 className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  voice: <Phone className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  published: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

export default function ContentCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newContent, setNewContent] = useState({
    title: "",
    content_type: "email",
    channel: "",
    scheduled_at: "",
    description: "",
  });

  useEffect(() => {
    fetchContent();
  }, [selectedDate]);

  const fetchContent = async () => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);

    const { data, error } = await supabase
      .from("content_calendar")
      .select("*")
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true });

    if (error) {
      toast.error("Failed to load calendar");
      console.error(error);
    } else {
      setContentItems((data as ContentItem[]) || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newContent.title || !newContent.scheduled_at) {
      toast.error("Please fill in all required fields");
      return;
    }

    const { error } = await supabase.from("content_calendar").insert({
      title: newContent.title,
      content_type: newContent.content_type,
      channel: newContent.channel || null,
      scheduled_at: new Date(newContent.scheduled_at).toISOString(),
      content: { description: newContent.description },
    });

    if (error) {
      toast.error("Failed to schedule content");
    } else {
      toast.success("Content scheduled!");
      setDialogOpen(false);
      setNewContent({ title: "", content_type: "email", channel: "", scheduled_at: "", description: "" });
      fetchContent();
    }
  };

  const handlePublishNow = async (contentId: string) => {
    try {
      const { error } = await supabase.functions.invoke("publish-scheduled-content", {
        body: { contentId, action: "publish_now" },
      });

      if (error) throw error;
      toast.success("Content published!");
      fetchContent();
    } catch (e) {
      toast.error("Failed to publish content");
    }
  };

  const handleDelete = async (contentId: string) => {
    const { error } = await supabase.from("content_calendar").delete().eq("id", contentId);

    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Content removed");
      fetchContent();
    }
  };

  const selectedDateContent = contentItems.filter((item) =>
    isSameDay(new Date(item.scheduled_at), selectedDate)
  );

  const datesWithContent = contentItems.map((item) => new Date(item.scheduled_at));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Content Calendar
          </CardTitle>
          <CardDescription>Schedule and manage content across channels</CardDescription>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            modifiers={{
              hasContent: datesWithContent,
            }}
            modifiersStyles={{
              hasContent: { fontWeight: "bold", textDecoration: "underline" },
            }}
            className="rounded-md border"
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Content
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule New Content</DialogTitle>
                <DialogDescription>Add content to your calendar for automated publishing</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newContent.title}
                    onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                    placeholder="e.g., Weekly Newsletter"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Content Type</Label>
                    <Select
                      value={newContent.content_type}
                      onValueChange={(v) => setNewContent({ ...newContent, content_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="social">Social Media</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="voice">Voice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Channel</Label>
                    <Input
                      value={newContent.channel}
                      onChange={(e) => setNewContent({ ...newContent, channel: e.target.value })}
                      placeholder="e.g., LinkedIn"
                    />
                  </div>
                </div>
                <div>
                  <Label>Scheduled Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={newContent.scheduled_at}
                    onChange={(e) => setNewContent({ ...newContent, scheduled_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newContent.description}
                    onChange={(e) => setNewContent({ ...newContent, description: e.target.value })}
                    placeholder="Brief description or notes..."
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">
                  Schedule Content
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Selected Date Content */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{format(selectedDate, "EEEE, MMMM d, yyyy")}</CardTitle>
          <CardDescription>
            {selectedDateContent.length} item{selectedDateContent.length !== 1 ? "s" : ""} scheduled
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {selectedDateContent.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No content scheduled for this date</p>
                <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Content
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDateContent.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {contentTypeIcons[item.content_type] || <CalendarIcon className="h-4 w-4" />}
                      </div>
                      <div>
                        <h4 className="font-medium">{item.title}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.scheduled_at), "h:mm a")}
                          {item.channel && (
                            <>
                              <span>•</span>
                              <span>{item.channel}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusColors[item.status]}>
                        {item.status}
                      </Badge>
                      {item.status === "scheduled" && (
                        <Button size="sm" variant="ghost" onClick={() => handlePublishNow(item.id)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
