using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Librecord.Infra.Migrations
{
    /// <inheritdoc />
    public partial class RemoveChannelManageChannelsPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Remove any channel permission overrides referencing this permission
            migrationBuilder.Sql(
                "DELETE FROM \"GuildChannelPermissionOverrides\" WHERE \"PermissionId\" = '22222222-2222-2222-2222-222222222207'");

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222207"));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Permissions",
                columns: new[] { "Id", "Name", "Type" },
                values: new object[] { new Guid("22222222-2222-2222-2222-222222222207"), "ManageChannels", "Channel" });
        }
    }
}
