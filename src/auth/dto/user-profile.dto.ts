import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";

export class UserProfileDto {
   @ApiProperty({
    example: "cmtaumdqa0000c93taluru1na",
    description: "User ID",
   })
    id: string;
    @ApiProperty({
        example: "test@basketball.com",
        description: "User email",
    })
    email: string;
    @ApiProperty({
        example: "John Doe",
        description: "User full name",
    })
    name: string | null;
    @ApiProperty({
        example: "ADMIN",
        description: "User role",
    })
    role: Role;
    @ApiProperty({
        type: "object",
        properties: {
            id: {
                type: "string",
                example: "cmtaumdqa0001c93t5eq74olr",
            },
            userId: {
                type: "string",
                example: "cmtaumdqa0000c93taluru1na",
            },
            fullName: {
                type: "string",
                example: "John Doe",
            },
            age: {
                type: "number",
                example: 25,
            },
            division: {
                type: "string",
                example: "Senior",
            },
            dobDay: {
                type: "number",
                example: 1,
            },
            dobMonth: {
                type: "number",
                example: 1,
            },
            dobYear: {
                type: "number",
                example: 2000,
            },
            phone: {
                type: "string",
                example: "1234567890",
            },
            email: {
                type: "string",
                example: "[EMAIL_ADDRESS]",
            },
            country: {
                type: "string",
                example: "USA",
            },
            state: {
                type: "string",
                example: "California",
            },
            homeAddress: {
                type: "string",
                example: "123 Main St",
            },
            bio: {
                type: "string",
                example: "Bio",
            },
            createdAt: {
                type: "string",
                example: "2026-08-27T01:33:12.322Z",
            },
            updatedAt: {
                type: "string",
                example: "2026-08-27T01:33:12.322Z",
            },
            photos: {
                type: "array",
                items: {
                    type: "string",
                    example: "https://example.com/photo.jpg",
                },
            },
        },
    })
    profile?: {
        id: string;
        userId: string;
        fullName: string | null;
        age: number | null;
        division: string | null;
        dobDay: number | null;
        dobMonth: number | null;
        dobYear: number | null;
        phone: string | null;
        email: string | null;
        country: string | null;
        state: string | null;
        homeAddress: string | null;
        bio: string | null;
        createdAt: Date | string;
        updatedAt: Date | string;
        photos: string[];
    };
  }