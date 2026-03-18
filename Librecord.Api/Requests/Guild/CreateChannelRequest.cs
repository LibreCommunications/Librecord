namespace Librecord.Api.Requests;

public class CreateChannelRequest
{
    public string Name { get; set; } = "";
    public int Type { get; set; }
    public int Position { get; set; }
    public string? Topic { get; set; }
}