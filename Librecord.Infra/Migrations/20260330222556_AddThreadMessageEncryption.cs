using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Librecord.Infra.Migrations
{
    /// <inheritdoc />
    public partial class AddThreadMessageEncryption : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EncryptionAlgorithm",
                table: "ThreadMessages",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<byte[]>(
                name: "EncryptionSalt",
                table: "ThreadMessages",
                type: "bytea",
                nullable: false,
                defaultValue: new byte[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EncryptionAlgorithm",
                table: "ThreadMessages");

            migrationBuilder.DropColumn(
                name: "EncryptionSalt",
                table: "ThreadMessages");
        }
    }
}
