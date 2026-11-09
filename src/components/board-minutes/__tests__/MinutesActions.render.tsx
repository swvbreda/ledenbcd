import {afterEach,describe,it,expect} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import {MinutesActions} from '../MinutesActions';
afterEach(cleanup);
describe('structured action data',()=>{
 it('keeps one supplied task, owner and deadline per row without legacy duplicates',()=>{
  render(<MinutesActions rows={[{action:'First task',owner:'Person A',deadline:'Before next meeting'},{action:'Second task',owner:'',deadline:''}]} actions={['Legacy duplicate']}/>);
  const rows=within(screen.getByRole('table')).getAllByRole('row');expect(rows).toHaveLength(3);expect(within(rows[1] as HTMLElement).getAllByRole('cell').map(c=>c.textContent)).toEqual(['First task','Person A','Before next meeting']);expect(within(rows[2] as HTMLElement).getAllByRole('cell').map(c=>c.textContent)).toEqual(['Second task','—','—']);expect(screen.queryByText('Legacy duplicate')).toBeNull();
 });
 it('retains historical action array when structured rows absent',()=>{render(<MinutesActions actions={['Historical one','Historical two']}/>);expect(screen.getAllByRole('listitem').map(i=>i.textContent)).toEqual(['Historical one','Historical two']);expect(screen.queryByRole('table')).toBeNull();});
});