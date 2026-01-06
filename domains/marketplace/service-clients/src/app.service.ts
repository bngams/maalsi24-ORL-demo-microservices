import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AppService {
  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly rabbitClient: ClientProxy,
  ) {}

  generateInvoice(clientId: string) {
    const invoiceData = {
      invoiceId: `INV-${Date.now()}`,
      clientId: clientId,
      amount: Math.floor(Math.random() * 1000) + 100,
      createdAt: new Date().toISOString(),
    };
    console.log('📤 Publishing invoice to RabbitMQ:', invoiceData);
    this.rabbitClient.emit('invoice_created', invoiceData);
    return {
      message: "Votre facture sera envoyée par email lorsqu'elle sera prête",
      invoiceId: invoiceData.invoiceId,
    };
  }
}
