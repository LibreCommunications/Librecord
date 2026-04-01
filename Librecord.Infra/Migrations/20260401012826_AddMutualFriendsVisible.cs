using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Librecord.Infra.Migrations
{
    /// <inheritdoc />
    public partial class AddMutualFriendsVisible : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "MutualFriendsVisible",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MutualFriendsVisible",
                table: "AspNetUsers");
        }
    }
}
