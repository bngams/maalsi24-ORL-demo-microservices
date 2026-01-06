import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';

@Controller()
export class AppController {
  @EventPattern('invoice_created')
  async handleInvoiceCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20000));
    console.log('📥 Received invoice from RabbitMQ:');
    console.log('-----------------------------------');
    console.log(`Invoice ID: ${data.invoiceId}`);
    console.log(`Client ID: ${data.clientId}`);
    console.log(`Amount: ${data.amount}€`);
    console.log(`Created At: ${data.createdAt}`);
    console.log('-----------------------------------');
    console.log('✅ Invoice processing completed!');
    console.log('📧 (Simulated) Email sent to client\n');
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }
}
