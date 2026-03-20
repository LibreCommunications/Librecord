using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Librecord.Infra.Migrations
{
    /// <inheritdoc />
    public partial class AddDmChannelIsGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsGroup",
                table: "DmChannels",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsGroup",
                table: "DmChannels");
        }
    }
}
